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

// Add TypeScript support for the Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}