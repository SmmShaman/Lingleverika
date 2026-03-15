# CLAUDE.md - NightOwl Linguist

## Project Overview

**NightOwl Linguist** -- a voice-powered language learning tool. The user watches foreign-language video/audio content in one tab, switches to NightOwl, speaks the unfamiliar word, and gets an instant AI-powered translation with definition, synonyms, phonetic transcription, and example sentences. Runs as a web app (Vite dev server) or an Electron desktop app (Windows).

**Primary use case:** Norwegian-to-Ukrainian translation for a learner watching Norwegian content, but supports 14 languages.

---

## Quick Start

```bash
npm install

# Web (browser tab)
npm run dev                    # http://localhost:3000

# Electron (desktop)
npm run electron:dev           # Launches Electron + Vite concurrently

# Build
npm run build                  # Vite production build
npm run electron:build:win     # Windows .exe via electron-builder
```

**Required:** Set `GEMINI_API_KEY` in `.env.local` (used at build time via Vite `define`).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript 5.8, Tailwind CSS (CDN) |
| Build | Vite 6 |
| AI | Google Gemini (`gemini-3-flash-preview` via `@google/genai`) |
| Audio | MediaRecorder API + Web Audio API (AnalyserNode for silence detection) |
| TTS | Web Speech Synthesis API (browser-native) |
| Icons | lucide-react |
| Desktop | Electron 35, electron-builder (NSIS installer) |
| Font | Inter (Google Fonts CDN) |

---

## Project Structure

```
.
├── App.tsx                    # Main app: recording logic, state, layout
├── index.tsx                  # React root mount
├── index.html                 # HTML shell (Tailwind CDN, Inter font)
├── types.ts                   # WordEntry, Language, AppSettings, RecordingState
├── constants.ts               # LANGUAGES list, DEFAULT_SYSTEM_PROMPT, DEFAULT_SETTINGS
├── vite.config.ts             # Vite config (injects GEMINI_API_KEY)
├── package.json               # Scripts, deps, electron-builder config
├── metadata.json              # AI Studio app metadata
│
├── components/
│   ├── SetupScreen.tsx        # First-run language picker (source + target)
│   ├── DictionaryCard.tsx     # Word card: translation, examples, blur mode, TTS
│   ├── SettingsModal.tsx      # Language + system prompt editor
│   ├── MicIndicator.tsx       # Animated recording bars
│   └── VideoSimulator.tsx     # Demo video player (unused in current flow)
│
├── services/
│   └── geminiService.ts       # Gemini API: transcribeAudio() + analyzeInput()
│
├── utils/
│   └── audioUtils.ts          # blobToBase64 helper
│
└── electron/
    ├── main.ts                # Electron main process (window, mic permissions)
    ├── preload.ts             # contextBridge (exposes isElectron flag)
    └── tsconfig.json          # Electron-specific TS config (CommonJS output)
```

---

## Core Architecture

### Audio Pipeline (App.tsx)

1. **startRecording()** -- getUserMedia -> MediaRecorder (webm/opus, 1s timeslice) + AudioContext AnalyserNode
2. **Silence detection** (requestAnimationFrame loop) -- RMS threshold (35) distinguishes speech from background noise
3. **Chunk send** -- after 1.5s silence or 8s max duration, chunks go to `transcribeAudio()` (Gemini)
4. **Auto-submit** -- transcribed text accumulates in the input field; auto-submits after 3s pause or >5 words
5. **Auto-shutdown** -- 60s inactivity timer stops recording (countdown visible on mic button)

### Gemini Service (services/geminiService.ts)

Two functions, both using `gemini-3-flash-preview`:

- **`transcribeAudio(blob, lang)`** -- sends base64 audio, returns raw transcription text
- **`analyzeInput(input, settings)`** -- accepts text or audio blob, returns structured JSON (`WordEntry`) using `responseSchema` for guaranteed format: original, translation, explanation, synonyms (max 3), examples (2 bilingual sentences), phonetic (IPA)

### Data Persistence

All state stored in **localStorage**:
- `nightowl_dictionary` -- array of WordEntry objects
- `nightowl_settings` -- AppSettings (sourceLang, targetLang, systemPrompt)
- `nightowl_setup_complete` -- boolean flag for first-run screen

### Study Mode (Global Blur)

Toggle "learning mode" to blur translations/explanations across all cards. Individual cards can also toggle blur independently. Uses CSS `blur-sm` with smooth transitions.

---

## Key Features

- **Voice input** with real-time silence detection and noise filtering
- **Text input** as fallback (same processing pipeline)
- **Structured AI responses** via Gemini JSON schema (no parsing heuristics)
- **14 languages** with auto-detect option for source
- **TTS playback** on dictionary cards (Web Speech Synthesis)
- **Study/blur mode** to practice recall before revealing translations
- **Keyboard shortcut** Alt+S to toggle recording
- **Customizable system prompt** for AI behavior
- **Electron packaging** for Windows desktop use with auto-granted mic permissions

---

## Environment Variables

```env
# .env.local
GEMINI_API_KEY=your_google_gemini_api_key
```

Injected at build time via `vite.config.ts` as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

---

## Supported Languages

Norwegian (default source), Ukrainian (default target), Auto-detect, English, Spanish, French, German, Italian, Japanese, Korean, Chinese, Portuguese, Swedish, Danish.

All UI text is hardcoded in Ukrainian.

---

## Development Notes

- Tailwind is loaded via CDN (`<script src="https://cdn.tailwindcss.com">`), not as a build dependency
- No testing framework is configured
- No linting config beyond default Vite/TS
- The `VideoSimulator` component exists but is not imported or used in the main app flow
- Electron uses `contextIsolation: true` with a minimal preload script
- The `metadata.json` file is for Google AI Studio app publishing
- Audio format: `audio/webm;codecs=opus` -- chunks under 10KB are discarded as noise
- The API key is embedded in the client bundle (acceptable for personal/desktop use, not for public deployment)
