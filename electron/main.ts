import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const isDev = !app.isPackaged;

// Whisper setup
let whisper: any = null;
const modelPath = isDev
  ? path.join(__dirname, '..', 'models', 'ggml-tiny.bin')
  : path.join(process.resourcesPath, 'models', 'ggml-tiny.bin');

try {
  whisper = require('@kutalia/whisper-node-addon');
  console.log('[Whisper] Addon loaded successfully');
} catch (e) {
  console.error('[Whisper] Failed to load addon:', e);
}

console.log('[Whisper] Model path:', modelPath);
console.log('[Whisper] Model exists:', fs.existsSync(modelPath));

// IPC: transcribe audio buffer (Float32 PCM → temp WAV → whisper)
ipcMain.handle('whisper:transcribe', async (_event, pcmData: number[], sampleRate: number, language?: string) => {
  console.log(`[Whisper] Received ${pcmData.length} samples, rate=${sampleRate}, lang=${language}`);
  if (!whisper) { console.error('[Whisper] Not loaded'); return { success: false, error: 'Whisper not loaded' }; }
  if (!fs.existsSync(modelPath)) { console.error('[Whisper] Model not found'); return { success: false, error: 'Model not found' }; }

  const tmpFile = path.join(os.tmpdir(), `nightowl_${Date.now()}.wav`);

  try {
    // Convert Float32 PCM to 16-bit WAV file
    const float32 = new Float32Array(pcmData);
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const wavHeader = createWavHeader(int16.length * 2, sampleRate, 1, 16);
    const wavBuffer = Buffer.concat([wavHeader, Buffer.from(int16.buffer)]);
    fs.writeFileSync(tmpFile, wavBuffer);

    console.log(`[Whisper] Transcribing ${tmpFile} (${wavBuffer.length} bytes)`);
    const result = await whisper.transcribe({
      fname_inp: tmpFile,
      model: modelPath,
      language: language && language !== 'auto' ? language : 'auto',
      use_gpu: false,
    });

    console.log('[Whisper] Raw result:', JSON.stringify(result));

    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}

    // Extract text from result
    let text = '';
    if (Array.isArray(result)) {
      text = result.map((seg: any) => seg[2] || seg.text || '').join(' ');
    } else if (typeof result === 'string') {
      text = result;
    }

    console.log('[Whisper] Extracted text:', text);
    return { success: true, text: text.trim() };
  } catch (error: any) {
    try { fs.unlinkSync(tmpFile); } catch {}
    console.error('Whisper transcription error:', error);
    return { success: false, error: error.message };
  }
});

function createWavHeader(dataSize: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'NightOwl Linguist',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = ['media', 'microphone'];
      callback(allowed.includes(permission));
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      const allowed = ['media', 'microphone'];
      return allowed.includes(permission);
    }
  );

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
