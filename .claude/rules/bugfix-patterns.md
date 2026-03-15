# Bug Fix Patterns & Known Issues

## Fixed Bugs (from git history)

### Background Noise Triggering Transcription (feb6f29)
**Problem:** Silent/ambient audio chunks were sent to Gemini for transcription, wasting API calls and producing garbage text.
**Fix:** Added `speechDetectedRef` flag. Chunks are only sent when RMS exceeds the speech threshold (35). Silent chunks are discarded after max duration (8s) to prevent memory buildup.

### Web Speech API Blocking MediaRecorder (edca2ff)
**Problem:** Original implementation used Web Speech API (`webkitSpeechRecognition`) for transcription, which competed with `getUserMedia` for the microphone, causing failures.
**Fix:** Replaced Web Speech API entirely with MediaRecorder + Gemini transcription pipeline (9d3f321). MicIndicator was also changed from getUserMedia-based level detection to pure CSS animation to avoid a second mic stream (edca2ff).

### Electron CommonJS Conflict (2294d60)
**Problem:** `"type": "module"` in package.json broke Electron's CommonJS-based main process.
**Fix:** Removed `"type": "module"` from package.json. Electron main compiles to CommonJS via its own tsconfig (`module: "commonjs"`).

## Common Pitfalls

### Stale State in requestAnimationFrame
The silence detection loop runs via `requestAnimationFrame` and cannot read current React state. Both `recordingState` and `textInput` are mirrored to refs (`recordingStateRef`, `textInputRef`) that are updated in `useEffect`. If you add new state that the recording loop needs, you MUST create a corresponding ref and sync it.

### Audio Chunk Minimum Size
Chunks smaller than 10,000 bytes (10KB) are silently discarded in `sendChunkToGemini()`. This prevents sending near-empty audio to Gemini. If you lower the MediaRecorder timeslice below 1000ms, this threshold may need adjustment.

### Auto-Submit Race Condition
The auto-submit logic uses a 3-second `setTimeout` that references `textInputRef.current`. If multiple transcription results arrive rapidly, earlier timers may fire with stale accumulated text. The current code clears the timer on each new transcription, which mitigates but does not fully eliminate this -- the >5 word threshold triggers an immediate submit that bypasses the timer.

### API Key Exposure
`GEMINI_API_KEY` from `.env.local` is injected via Vite `define` into the client bundle as a string literal. This is visible in browser DevTools and built JS files. For any public deployment, the Gemini calls should be proxied through a server.

### Electron Microphone Permissions
Electron has no Chrome-style permission prompt. The main process auto-grants `media` and `microphone` permissions via `setPermissionRequestHandler`. If new permissions are needed (e.g., camera), they must be added to the allowed list in `electron/main.ts`.

### localStorage Limits
The dictionary grows unboundedly in localStorage. Browsers typically cap localStorage at 5-10MB. A user with thousands of entries could hit this limit. No cleanup or export mechanism exists.

### MicIndicator Random Heights
`MicIndicator` generates random bar heights on each render (`Math.random()`). This means heights change on any parent re-render, not just when recording state changes. This is cosmetic-only but could cause unnecessary visual jitter.

### VideoSimulator Component
`VideoSimulator.tsx` exists in components/ but is NOT imported anywhere. It was likely part of an earlier design. It fetches a random image from `picsum.photos` on each render, which would cause network requests if re-enabled.

## Debugging Tips

- **Gemini API errors:** Check browser console for "Gemini API Error" or "Gemini transcription error" logs
- **Recording not starting:** Verify microphone permissions in browser settings; check console for "Error starting recording"
- **Silent audio sent to API:** Monitor `speechDetectedRef` -- if RMS threshold (35) is too low for your mic, increase it in `startSilenceDetection()`
- **Text not submitting:** Auto-submit requires either >5 words (immediate) or 3s of silence after last transcription. Manual Enter always works.
- **Dictionary not persisting:** Check localStorage quota; look for "Failed to parse dictionary" in console
