#!/usr/bin/env python3
"""
FastAPI KV store + static file server for local frontend development.

Storage layers (in priority order):
  1. In-memory dict  — always used, zero latency
  2. Redis           — optional; auto-detected on localhost:6379
  3. File            — data/kv.json, flushed after FLUSH_INTERVAL seconds of inactivity

Frontend usage:
  GET    /kv              → { keys: [...] }
  GET    /kv/<key>        → { key, value }
  PUT    /kv/<key>        → body = any JSON value  → { key, value }
  DELETE /kv/<key>        → { deleted: key }

Keys support slashes for namespacing: /kv/user/profile
"""
import asyncio
import contextlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import uvicorn
import yaml
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Config  (loaded from server.yaml at startup)
# ---------------------------------------------------------------------------

_CONFIG_FILE = Path("config.yaml")


def _load_config() -> dict:
    if not _CONFIG_FILE.exists():
        print(f"[config] {_CONFIG_FILE} not found — using defaults")
        return {}
    try:
        with _CONFIG_FILE.open() as f:
            return yaml.safe_load(f) or {}
    except Exception as exc:
        print(f"[config] failed to parse {_CONFIG_FILE}: {exc} — using defaults")
        return {}


_cfg = _load_config()

PORT            = int(os.environ.get("PORT", _cfg.get("server", {}).get("port", 5500)))
HOST            = "127.0.0.1"   # localhost-only; never 0.0.0.0
DATA_DIR        = Path("data")
KV_FILE         = DATA_DIR / "kv.json"
FLUSH_INTERVAL  = float(os.environ.get(
    "FLUSH_INTERVAL", _cfg.get("server", {}).get("flush_interval", 5)
))

_limits         = _cfg.get("limits", {})
MAX_BODY_BYTES  = _limits.get("max_body_kb",   512) * 1024
MAX_VALUE_BYTES = _limits.get("max_value_kb",  256) * 1024
MAX_KEY_LENGTH  = _limits.get("max_key_length", 256)
MAX_STORE_KEYS  = _limits.get("max_store_keys", 10_000)

_VALID_KEY_RE   = re.compile(r'^[\w\-./: ]+$')   # alphanumeric + safe punctuation

# Trusted Host header values — loaded from yaml, with a safe default
_TRUSTED_HOSTS: set[str] = set(
    _cfg.get("allowed_hosts") or [f"localhost:{PORT}", f"127.0.0.1:{PORT}"]
)

# URL path prefixes the static server must not serve
_BLOCKED_STATIC: list[str] = _cfg.get("blocked_static") or [
    "/server.yaml",
    "/data",
]

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

store: dict[str, Any] = {}
_dirty = False
_last_write = 0.0
redis_client = None  # set during startup if Redis is available

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _load_file() -> None:
    if KV_FILE.exists():
        try:
            data = json.loads(KV_FILE.read_text())
            if isinstance(data, dict):
                store.update(data)
                print(f"[kv] loaded {len(data)} keys from {KV_FILE}")
        except Exception as exc:
            print(f"[kv] could not load {KV_FILE}: {exc}")


def _flush_file() -> None:
    global _dirty, _last_write
    DATA_DIR.mkdir(exist_ok=True)
    KV_FILE.write_text(json.dumps(store, indent=2, ensure_ascii=False))
    _dirty = False
    _last_write = time.monotonic()


def _mark_dirty() -> None:
    global _dirty
    _dirty = True


# ---------------------------------------------------------------------------
# Redis helper
# ---------------------------------------------------------------------------

REDIS_PREFIX = "pages:kv:"


async def _init_redis() -> None:
    global redis_client
    try:
        import redis.asyncio as aioredis  # type: ignore

        client = aioredis.Redis(decode_responses=True)
        await client.ping()
        redis_client = client
        print("[kv] Redis connected — using as secondary cache")
    except Exception:
        redis_client = None
        print("[kv] Redis not available — memory + file only")


async def _redis_get(key: str) -> Any | None:
    if not redis_client:
        return None
    raw = await redis_client.get(REDIS_PREFIX + key)
    return json.loads(raw) if raw is not None else None


async def _redis_set(key: str, value: Any) -> None:
    if redis_client:
        await redis_client.set(REDIS_PREFIX + key, json.dumps(value, ensure_ascii=False))


async def _redis_delete(key: str) -> None:
    if redis_client:
        await redis_client.delete(REDIS_PREFIX + key)


# ---------------------------------------------------------------------------
# Background flush loop
# ---------------------------------------------------------------------------


async def _flush_loop() -> None:
    while True:
        await asyncio.sleep(1)
        if _dirty and (time.monotonic() - _last_write) >= FLUSH_INTERVAL:
            _flush_file()
            print(f"[kv] flushed {len(store)} keys → {KV_FILE}")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Pages KV Server", docs_url="/api/docs")

# ── CORS: localhost origins only ─────────────────────────────────────────────
_LOCALHOST_ORIGINS = [
    f"http://localhost:{PORT}",
    f"http://127.0.0.1:{PORT}",
    # allow other local ports for dev convenience (e.g. Vite on 5173)
    "http://localhost",
    "http://127.0.0.1",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_LOCALHOST_ORIGINS,
    allow_methods=["GET", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


# ── DNS-rebinding protection ─────────────────────────────────────────────────
class _HostGuard(BaseHTTPMiddleware):
    """Reject requests whose Host header isn't localhost.
    This blocks DNS-rebinding: evil.com resolves to 127.0.0.1 but still
    sends Host: evil.com, which we refuse."""

    async def dispatch(self, request: Request, call_next):
        # Skip for static assets to keep DevTools / browser prefetch happy
        if not request.url.path.startswith("/kv"):
            return await call_next(request)
        host = request.headers.get("host", "")
        if host not in _TRUSTED_HOSTS:
            return JSONResponse({"detail": "Forbidden host"}, status_code=403)
        return await call_next(request)


app.add_middleware(_HostGuard)


# ── Body size cap ─────────────────────────────────────────────────────────────
class _BodySizeLimit(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("PUT", "POST", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_BODY_BYTES:
                return JSONResponse(
                    {"detail": f"Body exceeds {MAX_BODY_BYTES // 1024} KB limit"},
                    status_code=413,
                )
        return await call_next(request)


app.add_middleware(_BodySizeLimit)


# ── Block server-side files from static serving ───────────────────────────────
class _BlockedStaticPaths(BaseHTTPMiddleware):
    """Return 403 for any path that starts with a blocked prefix.
    Prevents the browser from reading server.yaml, data/kv.json, etc."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        for prefix in _BLOCKED_STATIC:
            if path == prefix or path.startswith(prefix.rstrip("/") + "/"):
                return JSONResponse({"detail": "Forbidden"}, status_code=403)
        return await call_next(request)


app.add_middleware(_BlockedStaticPaths)


@contextlib.asynccontextmanager
async def _lifespan(app: FastAPI):
    # startup
    _load_file()
    await _init_redis()
    flush_task = asyncio.create_task(_flush_loop())
    yield
    # shutdown
    flush_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await flush_task
    if _dirty:
        _flush_file()
        print(f"[kv] shutdown flush → {KV_FILE}")
    if redis_client:
        await redis_client.aclose()


app.router.lifespan_context = _lifespan


# ---------------------------------------------------------------------------
# KV API routes  (must be declared BEFORE the static file catch-all)
# ---------------------------------------------------------------------------


@app.get("/kv")
async def list_keys():
    return {"keys": list(store.keys()), "count": len(store)}


@app.get("/kv/{key:path}")
async def get_value(key: str):
    # Redis first (warm cache hit)
    cached = await _redis_get(key)
    if cached is not None:
        return {"key": key, "value": cached}
    if key not in store:
        raise HTTPException(status_code=404, detail=f"Key '{key}' not found")
    return {"key": key, "value": store[key]}


def _validate_key(key: str) -> None:
    if not key:
        raise HTTPException(400, "Key must not be empty")
    if len(key) > MAX_KEY_LENGTH:
        raise HTTPException(400, f"Key exceeds {MAX_KEY_LENGTH} character limit")
    if not _VALID_KEY_RE.match(key):
        raise HTTPException(400, "Key contains invalid characters")


@app.put("/kv/{key:path}")
async def set_value(key: str, request: Request):
    """Body is the raw JSON value — object, array, string, number, bool, or null."""
    _validate_key(key)
    if key not in store and len(store) >= MAX_STORE_KEYS:
        raise HTTPException(507, f"Store full: {MAX_STORE_KEYS} key limit reached")
    try:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            raise HTTPException(413, f"Body exceeds {MAX_BODY_BYTES // 1024} KB limit")
        value = json.loads(body)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Body must be valid JSON")
    raw = json.dumps(value, ensure_ascii=False)
    if len(raw.encode()) > MAX_VALUE_BYTES:
        raise HTTPException(413, f"Value exceeds {MAX_VALUE_BYTES // 1024} KB limit")
    store[key] = value
    _mark_dirty()
    await _redis_set(key, value)
    return {"key": key, "value": value}


@app.delete("/kv/{key:path}")
async def delete_value(key: str):
    _validate_key(key)
    if key not in store:
        raise HTTPException(status_code=404, detail=f"Key '{key}' not found")
    del store[key]
    _mark_dirty()
    await _redis_delete(key)
    return {"deleted": key}


# ---------------------------------------------------------------------------
# Static file serving (catch-all — must be LAST)
# ---------------------------------------------------------------------------

app.mount("/", StaticFiles(directory=".", html=True), name="static")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("server:app", host=HOST, port=PORT, reload=True)
