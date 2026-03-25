/**
 * window.kv — browser-side client for the FastAPI KV store.
 *
 * Falls back to localStorage when the server is unreachable
 * (e.g. opened directly as a file:// page).
 *
 * Usage:
 *   await kv.set('user/prefs', { theme: 'dark' })
 *   const prefs = await kv.get('user/prefs')
 *   await kv.del('user/prefs')
 *   const { keys } = await kv.list()
 *
 * The value passed to set() can be any JSON-serialisable type.
 * get() returns the value directly (not wrapped), or undefined if missing.
 */
(function (global) {
  const BASE = '/kv';
  const LS_PREFIX = '__kv__';

  // -------------------------------------------------------------------------
  // localStorage shim (fallback when server is unreachable)
  // -------------------------------------------------------------------------

  const ls = {
    get(key) {
      const raw = localStorage.getItem(LS_PREFIX + key);
      try { return raw !== null ? JSON.parse(raw) : undefined; } catch { return undefined; }
    },
    set(key, value) {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    },
    del(key) {
      localStorage.removeItem(LS_PREFIX + key);
    },
    list() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(LS_PREFIX)) keys.push(k.slice(LS_PREFIX.length));
      }
      return { keys };
    },
  };

  // -------------------------------------------------------------------------
  // Server availability probe (lazy, cached)
  // -------------------------------------------------------------------------

  let _serverAvailable = null; // null = unknown, true/false = resolved

  async function _probeServer() {
    if (_serverAvailable !== null) return _serverAvailable;
    try {
      const r = await fetch(BASE, { method: 'GET', signal: AbortSignal.timeout(800) });
      _serverAvailable = r.ok;
    } catch {
      _serverAvailable = false;
    }
    if (!_serverAvailable) {
      console.warn('[kv] server unreachable — using localStorage fallback');
    }
    return _serverAvailable;
  }

  // -------------------------------------------------------------------------
  // Core API
  // -------------------------------------------------------------------------

  /**
   * Get a value by key.
   * @returns {Promise<any>} the value, or undefined if not found
   */
  async function get(key) {
    if (await _probeServer()) {
      try {
        const r = await fetch(`${BASE}/${encodeKey(key)}`);
        if (r.status === 404) return undefined;
        if (!r.ok) throw new Error(r.statusText);
        const { value } = await r.json();
        return value;
      } catch (err) {
        console.error('[kv] get error', err);
      }
    }
    return ls.get(key);
  }

  /**
   * Set a value. Value can be any JSON-serialisable type.
   * @returns {Promise<any>} the stored value
   */
  async function set(key, value) {
    if (await _probeServer()) {
      try {
        const r = await fetch(`${BASE}/${encodeKey(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        });
        if (!r.ok) throw new Error(r.statusText);
        const data = await r.json();
        // mirror to localStorage so pages work offline after first load
        ls.set(key, data.value);
        return data.value;
      } catch (err) {
        console.error('[kv] set error', err);
      }
    }
    ls.set(key, value);
    return value;
  }

  /**
   * Delete a key.
   * @returns {Promise<boolean>} true if deleted, false if not found
   */
  async function del(key) {
    if (await _probeServer()) {
      try {
        const r = await fetch(`${BASE}/${encodeKey(key)}`, { method: 'DELETE' });
        if (r.status === 404) return false;
        if (!r.ok) throw new Error(r.statusText);
        ls.del(key);
        return true;
      } catch (err) {
        console.error('[kv] del error', err);
      }
    }
    ls.del(key);
    return true;
  }

  /**
   * List all keys.
   * @returns {Promise<{ keys: string[], count: number }>}
   */
  async function list() {
    if (await _probeServer()) {
      try {
        const r = await fetch(BASE);
        if (!r.ok) throw new Error(r.statusText);
        return await r.json();
      } catch (err) {
        console.error('[kv] list error', err);
      }
    }
    return ls.list();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Encode a namespaced key for use in a URL path (preserve slashes). */
  function encodeKey(key) {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  // -------------------------------------------------------------------------
  // Expose global
  // -------------------------------------------------------------------------

  global.kv = { get, set, del, list };

}(window));
