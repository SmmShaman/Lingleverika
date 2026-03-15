# Deployment

## Prerequisites

- Node.js (no specific version pinned)
- `GEMINI_API_KEY` set in `.env.local`

## Web (Browser) Development

```bash
npm install
npm run dev          # Vite dev server at http://localhost:3000
```

The API key is injected at build time via `vite.config.ts`:
```
process.env.API_KEY = env.GEMINI_API_KEY
process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
```

Both variables resolve to the same key. The service reads `process.env.API_KEY`.

## Web Production Build

```bash
npm run build        # Output: dist/
npm run preview      # Preview production build locally
```

**Warning:** The Gemini API key is embedded in the client JS bundle. This is acceptable for personal/local use but not suitable for public-facing deployment without a backend proxy.

## Electron Desktop App

### Development
```bash
npm run electron:dev
```
This runs `concurrently`:
1. `vite` (web dev server on port 3000)
2. `wait-on http://localhost:3000 && electron dist-electron/main.js`

The Electron main process is compiled separately:
```bash
tsc -p electron/tsconfig.json   # Outputs to dist-electron/
```

### Production Build (Windows)
```bash
npm run electron:build:win
```
Steps:
1. `vite build` (web assets to `dist/`)
2. `tsc -p electron/tsconfig.json` (Electron main to `dist-electron/`)
3. `electron-builder --win` (NSIS installer to `release/`)

### electron-builder Config (in package.json)
- App ID: `com.nightowl.linguist`
- Product name: `NightOwl Linguist`
- Target: NSIS (one-click installer, per-user)
- Files included: `dist/**/*` + `dist-electron/**/*`

## Google AI Studio

The `metadata.json` file enables publishing as a Google AI Studio app:
- Name: "NightOwl Linguist"
- Requires: microphone permission
- AI Studio URL: https://ai.studio/apps/drive/16aoXrBL4wN9ZOQWNW239nObWn5idtn1W

## Build Outputs

| Command | Output Directory | Contents |
|---------|-----------------|----------|
| `npm run build` | `dist/` | Vite web build (HTML + JS + assets) |
| `tsc -p electron/tsconfig.json` | `dist-electron/` | Compiled Electron main + preload |
| `npm run electron:build:win` | `release/` | Windows installer (.exe) |

## Gitignored Artifacts

From `.gitignore`: `node_modules`, `dist`, `dist-ssr`, `dist-electron`, `release`, `*.local`

## No CI/CD

No GitHub Actions workflows or deployment automation exists. All builds are manual/local.

## Tailwind CSS

Tailwind is loaded via CDN script tag in `index.html`, not as an npm dependency. This means:
- No `tailwind.config.js` to maintain
- No purging of unused classes
- Requires internet connection on first load (cached after)
- Not suitable for offline-first without switching to npm Tailwind
