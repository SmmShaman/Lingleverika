import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  transcribeAudio: (pcmData: number[], sampleRate: number, language?: string): Promise<{ success: boolean; text?: string; error?: string }> => {
    return ipcRenderer.invoke('whisper:transcribe', pcmData, sampleRate, language);
  },
});
