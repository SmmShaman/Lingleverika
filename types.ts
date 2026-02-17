export interface WordEntry {
  id: string;
  original: string;
  phonetic?: string;
  translation: string;
  explanation: string;
  synonyms: string[];
  examples: {
    original: string;
    translation: string;
  }[];
  context?: string;
  timestamp: number;
}

export interface Language {
  code: string;
  name: string;
}

export interface AppSettings {
  sourceLang: string;
  targetLang: string;
  systemPrompt: string;
}

export enum RecordingState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  ERROR = 'ERROR'
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    electronAPI?: {
      isElectron: boolean;
      transcribeAudio: (pcmData: number[], sampleRate: number, language?: string) => Promise<{
        success: boolean;
        text?: string;
        error?: string;
      }>;
    };
  }
}