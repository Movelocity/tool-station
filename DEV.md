# Pages — Dev Doc

## Overview
A static, client-side web tool dashboard. No build step, no backend, no npm. Tools are registered via config and rendered as cards on the hub page.

## Stack
- **Vanilla JS (ES6+)** — modular files, no framework
- **Tailwind CSS** — via CDN (`lib/tailwind.js`)
- **Canvas API** — used in image-process and json-canvas
- **Fonts** — Inter (`lib/fonts-inter.css`), Fira Code (`lib/fonts-fira.css`)

## Project Structure
```
pages/
├── index.html              # Hub dashboard
├── config/pages.json       # Tool registry
├── lib/                    # Shared CDN/font assets
├── image-process/          # Canvas image editor
│   ├── index.html
│   └── libs/               # ~12 modular JS components
├── json-canvas/            # Multi-pane JSON viewer
│   ├── index.html
│   └── js/
├── jwt/                    # JWT decoder
│   └── index.html
│── rocket/                 # Probability simulator
└   └── index.html             
```

## Adding a New Tool

1. Create a new folder (e.g. `my-tool/index.html`)
2. Register it in `config/pages.json`:
```json
{
  "path": "/my-tool/",
  "title": "My Tool",
  "description": "What it does",
  "category": "utility"
}
```
3. Link shared assets using relative paths: `../lib/tailwind.js`, `../lib/fonts-inter.css`

## Tool Conventions
- Dark theme, mint-green (`#4ade80`) as accent
- Use Tailwind utility classes for layout
- Modular JS: split logic into `libs/` or `js/` subdirectory for non-trivial tools
- No localStorage unless the tool clearly benefits from persistence (json-canvas uses it)

## Existing Tools

| Tool | Path | Key Tech |
|------|------|----------|
| Hub Dashboard | `index.html` | Dynamic card grid from `pages.json` |
| Image Canvas | `image-process/` | Canvas API, crop/resize/export |
| JSON Canvas | `json-canvas/` | Multi-pane draggable windows, localStorage |
| JWT Decoder | `jwt/` | Token parsing, syntax highlighting |
| Rocket Sim | `rocket.html` | Probability model, grid visualization |

## Dev Server
No build required. Serve with any static file server:
```sh
python3 -m http.server 8080
# or
npx serve .
```

## Style Guide
- Prefer `class` in HTML + Tailwind over inline styles
- Keep tools self-contained — no shared state between tools
- `pages.json` supports external links too (just use a full URL as `path`)
