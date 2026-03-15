# Architecture

## Application Flow

```
SetupScreen (first run)
    ↓ saves settings + setup flag to localStorage
App (main screen)
    ├── Header (sticky)
    │   ├── Logo (hidden on mobile)
    │   ├── Mic button (toggle recording, Alt+S hotkey)
    │   ├── MicIndicator (animated bars when recording)
    │   ├── Text input (shows transcribed text, manual entry)
    │   ├── Language indicator badge (SRC → TGT)
    │   └── Status pill (Готово / Мікрофон / Обробка)
    │
    ├── Dictionary list (full-width cards, newest first)
    │   ├── Global blur toggle ("Режим вивчення")
    │   ├── Clear all button
    │   └── DictionaryCard[] (word, phonetic, translation, explanation, synonyms, examples)
    │
    └── SettingsModal (language pair + system prompt editor)
```

## Audio Recording Pipeline

```
getUserMedia → MediaRecorder (1s timeslice) → audioChunks[]
                    ↕
            AudioContext → AnalyserNode → RMS calculation (requestAnimationFrame)
                    ↓
            Speech detected? (RMS > 35)
                    ↓
            Silence 1.5s OR chunk 8s max
                    ↓
            sendChunkToGemini() → transcribeAudio() → text appended to input
                    ↓
            Auto-submit: >5 words immediately, OR 3s debounce timer
                    ↓
            analyzeInput() → WordEntry → prepend to dictionary[]
```

## State Management

No external state library. All state lives in App.tsx via `useState`:

| State | Type | Persisted | Storage Key |
|-------|------|-----------|-------------|
| dictionary | WordEntry[] | Yes | nightowl_dictionary |
| settings | AppSettings | Yes | nightowl_settings |
| isSetupComplete | boolean | Yes | nightowl_setup_complete |
| recordingState | RecordingState enum | No | -- |
| textInput | string | No | -- |
| shutdownTimeLeft | number | No | -- |
| isGlobalBlur | boolean | No | -- |
| isSettingsOpen | boolean | No | -- |

Critical: `recordingState` is mirrored to `recordingStateRef` because the silence detection loop runs in requestAnimationFrame and cannot access stale React state.

Similarly, `textInputRef` mirrors `textInput` so the async `sendChunkToGemini` callback always reads the latest accumulated text.

## Gemini Integration

Two API calls, both via `@google/genai` SDK:

1. **Transcription** -- raw text output, prompt: "Transcribe exactly as spoken in {language}"
2. **Analysis** -- structured JSON output via `responseSchema` (enforced by Gemini), includes translation, explanation, synonyms, examples, phonetic

The analysis prompt combines:
- Resolved language names (not just codes)
- The user's custom system prompt from settings
- Explicit instructions about target language for explanation field

## Electron Architecture

- `electron/main.ts` -- creates BrowserWindow, auto-grants microphone permission
- `electron/preload.ts` -- exposes `window.electronAPI.isElectron` (not currently consumed by renderer)
- Dev mode loads `http://localhost:3000`, production loads built `dist/index.html`
- Separate `tsconfig.json` in electron/ compiles to CommonJS (dist-electron/)

## Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| App.tsx | All business logic: recording, transcription, AI analysis, state management |
| SetupScreen | One-time language selection, renders only before setup completion |
| DictionaryCard | Display single word entry, per-card blur toggle, TTS playback, delete |
| SettingsModal | Edit source/target language and system prompt |
| MicIndicator | Pure visual: 5 animated bars when recording |
| VideoSimulator | Unused demo component (video player mockup) |

## Key Design Decisions

- **No backend** -- everything runs client-side, API key embedded in bundle
- **No database** -- localStorage only, dictionary is ephemeral by design
- **Silence-based chunking** -- avoids fixed-interval polling, reduces unnecessary API calls
- **Speech detection filter** -- chunks with no RMS above threshold are discarded without API call
- **Structured JSON schema** -- Gemini returns guaranteed format, no fragile regex/parsing
- **Ukrainian UI** -- all interface text is hardcoded Ukrainian, not internationalized
