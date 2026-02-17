import React, { useState, useEffect, useRef } from 'react';
import { Mic, Book, Settings, Keyboard, Loader2, SendHorizontal, MoveRight, ExternalLink, Eye, EyeOff, MicOff } from 'lucide-react';
import { WordEntry, AppSettings, RecordingState } from './types';
import { DEFAULT_SETTINGS, LANGUAGES } from './constants';
import { analyzeInput } from './services/geminiService';
import DictionaryCard from './components/DictionaryCard';
import SettingsModal from './components/SettingsModal';
import SetupScreen from './components/SetupScreen';
import MicIndicator from './components/MicIndicator';

const App: React.FC = () => {
  // State
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [dictionary, setDictionary] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [shutdownTimeLeft, setShutdownTimeLeft] = useState(60);
  const [isGlobalBlur, setIsGlobalBlur] = useState(false);
  
  // Refs
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pcmBufferRef = useRef<Float32Array[]>([]);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const lastLoudTimeRef = useRef<number>(0);
  const chunkStartTimeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);
  const recordingStateRef = useRef<RecordingState>(RecordingState.IDLE);
  const topOfListRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<string>("");
  
  // Timers for auto-logic
  const submitTimerRef = useRef<any>(null);
  const shutdownIntervalRef = useRef<any>(null);

  // Sync Ref with State
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Load from local storage on mount
  useEffect(() => {
    const savedDict = localStorage.getItem('nightowl_dictionary');
    const savedSettings = localStorage.getItem('nightowl_settings');
    const savedSetup = localStorage.getItem('nightowl_setup_complete');
    
    if (savedSetup === 'true') {
      setIsSetupComplete(true);
    }

    if (savedDict) {
      try {
        setDictionary(JSON.parse(savedDict));
      } catch (e) {
        console.error("Failed to parse dictionary", e);
      }
    }
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('nightowl_dictionary', JSON.stringify(dictionary));
  }, [dictionary]);

  useEffect(() => {
    localStorage.setItem('nightowl_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync textInputRef with textInput state
  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);

  // Track whether actual speech was detected in this chunk
  const speechDetectedRef = useRef(false);
  const transcribingRef = useRef(false);

  // Send accumulated PCM audio to Whisper via IPC
  const sendChunkToWhisper = async () => {
    if (pcmBufferRef.current.length === 0) return;
    if (!speechDetectedRef.current) {
      pcmBufferRef.current = [];
      return;
    }
    if (transcribingRef.current) return; // Don't overlap requests

    const chunks = [...pcmBufferRef.current];
    pcmBufferRef.current = [];
    speechDetectedRef.current = false;
    transcribingRef.current = true;

    // Merge PCM chunks into one Float32Array
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLength < 4000) { transcribingRef.current = false; return; } // Skip tiny clips

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      const sampleRate = audioContextRef.current?.sampleRate || 16000;

      // Use Whisper via Electron IPC if available, otherwise fall back to Gemini
      let trimmedText = '';

      if (window.electronAPI?.transcribeAudio) {
        const result = await window.electronAPI.transcribeAudio(
          Array.from(merged), sampleRate, settings.sourceLang
        );
        if (result.success && result.text) {
          trimmedText = result.text.trim();
        }
      }

      if (!trimmedText) { transcribingRef.current = false; return; }

      // Filter out whisper hallucinations (common with silence/noise)
      if (trimmedText.startsWith('[') || trimmedText.startsWith('(') || trimmedText.length < 2) {
        transcribingRef.current = false;
        return;
      }

      resetShutdownTimer();

      const newText = textInputRef.current ? `${textInputRef.current} ${trimmedText}` : trimmedText;
      setTextInput(newText);

      const wordCount = newText.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

      if (wordCount > 5) {
        handleProcessInput(newText);
        transcribingRef.current = false;
        return;
      }

      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      submitTimerRef.current = setTimeout(() => {
        handleProcessInput(newText);
      }, 3000);
    } catch (error) {
      console.error("Transcription failed:", error);
    }
    transcribingRef.current = false;
  };

  // Silence detection using AnalyserNode RMS
  const startSilenceDetection = () => {
    const SPEECH_THRESHOLD = 35;
    const SILENCE_DURATION_MS = 1000;   // 1s silence triggers send (faster with local whisper)
    const MAX_CHUNK_DURATION_MS = 6000; // Force send after 6s

    const checkSilence = () => {
      if (recordingStateRef.current !== RecordingState.RECORDING) return;
      if (!analyserRef.current) return;

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length) * 128;

      const now = Date.now();

      if (rms > SPEECH_THRESHOLD) {
        lastLoudTimeRef.current = now;
        speechDetectedRef.current = true;
        resetShutdownTimer();
      }

      const silenceDuration = now - lastLoudTimeRef.current;
      const chunkDuration = now - chunkStartTimeRef.current;

      if (speechDetectedRef.current
          && (silenceDuration >= SILENCE_DURATION_MS || chunkDuration >= MAX_CHUNK_DURATION_MS)
          && pcmBufferRef.current.length > 0) {
        sendChunkToWhisper();
        chunkStartTimeRef.current = Date.now();
        lastLoudTimeRef.current = Date.now();
      }

      if (!speechDetectedRef.current && chunkDuration >= MAX_CHUNK_DURATION_MS) {
        pcmBufferRef.current = [];
        chunkStartTimeRef.current = Date.now();
      }

      silenceTimerRef.current = requestAnimationFrame(checkSilence);
    };

    silenceTimerRef.current = requestAnimationFrame(checkSilence);
  };

  // Audio Recording — capture raw PCM via ScriptProcessorNode
  const startRecording = async () => {
    try {
      setTextInput("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Capture raw PCM using ScriptProcessorNode
      const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (event) => {
        if (recordingStateRef.current !== RecordingState.RECORDING) return;
        const input = event.inputBuffer.getChannelData(0);
        pcmBufferRef.current.push(new Float32Array(input));
      };
      source.connect(scriptNode);
      scriptNode.connect(audioContext.destination);
      scriptNodeRef.current = scriptNode;

      pcmBufferRef.current = [];
      setRecordingState(RecordingState.RECORDING);
      resetShutdownTimer();

      lastLoudTimeRef.current = Date.now();
      chunkStartTimeRef.current = Date.now();
      startSilenceDetection();
    } catch (error) {
      console.error("Error starting recording:", error);
      setRecordingState(RecordingState.ERROR);
    }
  };

  const stopRecording = () => {
    recordingStateRef.current = RecordingState.IDLE;

    if (silenceTimerRef.current) {
      cancelAnimationFrame(silenceTimerRef.current);
      silenceTimerRef.current = 0;
    }

    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (pcmBufferRef.current.length > 0 && speechDetectedRef.current) {
      sendChunkToWhisper();
    }

    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    if (shutdownIntervalRef.current) clearInterval(shutdownIntervalRef.current);

    pcmBufferRef.current = [];
    setRecordingState(RecordingState.IDLE);
  };

  const resetShutdownTimer = () => {
    // Reset the timestamp of last activity
    lastActivityRef.current = Date.now();
    setShutdownTimeLeft(60);

    // Ensure the interval is running
    if (shutdownIntervalRef.current) clearInterval(shutdownIntervalRef.current);
    
    shutdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, 60 - Math.floor(elapsed / 1000));
      
      setShutdownTimeLeft(remaining);
      
      if (remaining <= 0) {
        stopRecording();
      }
    }, 1000);
  };

  const handleMicClick = () => {
    if (recordingState === RecordingState.RECORDING) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Hotkey Listener (Alt+S)
  useEffect(() => {
    if (!isSetupComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        if (recordingState === RecordingState.IDLE) {
          startRecording();
        } else if (recordingState === RecordingState.RECORDING) {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingState, isSetupComplete, textInput]); 

  // Input Processing
  const handleProcessInput = async (input: Blob | string) => {
    if (typeof input === 'string' && !input.trim()) return;

    if (recordingStateRef.current === RecordingState.RECORDING) {
      resetShutdownTimer();
    }

    try {
      analyzeInput(input, settings).then(result => {
         setDictionary(prev => [result, ...prev]);
         window.scrollTo({ top: 0, behavior: 'smooth' });
      }).catch(err => console.error("Processing failed", err));

      if (typeof input === 'string') {
        setTextInput("");
      }
    } catch (error) {
      console.error("Processing failed", error);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleProcessInput(textInput);
    
    // If manual submit, we clear text but keep recording if it was on
    setTextInput("");
  };

  const handleDeleteEntry = (id: string) => {
    setDictionary(prev => prev.filter(item => item.id !== id));
  };

  const handleSetupComplete = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setIsSetupComplete(true);
    localStorage.setItem('nightowl_setup_complete', 'true');
  };

  const getLangName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;
  const getLangShort = (code: string) => code.toUpperCase();

  if (!isSetupComplete) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-orange-500/30 font-sans pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-20 w-full items-center justify-between px-4 sm:px-6 gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0 hidden md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 shadow-lg shadow-orange-500/20 text-white">
              <Book size={18} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              NightOwl
            </h1>
          </div>
          
          {/* Central Input Zone */}
          <div className="flex flex-1 items-center justify-center gap-3 max-w-3xl">
             {/* Mic Button */}
             <button
                onClick={handleMicClick}
                className={`shrink-0 group relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
                  recordingState === RecordingState.RECORDING
                    ? 'bg-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)]'
                    : recordingState === RecordingState.PROCESSING
                    ? 'bg-orange-900 cursor-wait'
                    : 'bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-500/20'
                }`}
                title="Натисніть для запису (Alt+S)"
              >
                {recordingState === RecordingState.PROCESSING ? (
                  <Loader2 size={20} className="animate-spin text-orange-200" />
                ) : (
                  <Mic 
                    size={20} 
                    className={`text-white transition-transform duration-200 ${recordingState === RecordingState.RECORDING ? 'scale-110' : ''}`} 
                  />
                )}
                
                {recordingState === RecordingState.RECORDING && (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20"></span>
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-red-500 ring-2 ring-slate-900">
                      {shutdownTimeLeft}
                    </span>
                  </>
                )}
              </button>

             {/* Audio Level Indicator */}
             <MicIndicator isRecording={recordingState === RecordingState.RECORDING} />

             {/* Input Field */}
             <form onSubmit={handleTextSubmit} className="relative w-full flex-1">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={recordingState === RecordingState.RECORDING ? "Слухаю..." : "Введіть слово..."}
                  className="w-full h-12 rounded-xl bg-slate-900 border border-slate-700 pl-4 pr-32 text-lg font-bold text-yellow-400 placeholder-slate-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition-all"
                  disabled={recordingState === RecordingState.PROCESSING}
                />
                
                {/* Language Indicator & Hotkey Hint inside input */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                   <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                     {getLangShort(settings.sourceLang)} <MoveRight size={10} /> {getLangShort(settings.targetLang)}
                   </span>
                   <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-600">
                      <Keyboard size={10}/> Alt+S
                   </div>
                </div>
              </form>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
             <div className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
               recordingState === RecordingState.RECORDING
                 ? 'bg-red-950/50 border-red-500/50'
                 : recordingState === RecordingState.PROCESSING
                 ? 'bg-orange-950/50 border-orange-500/50'
                 : 'bg-slate-900 border-slate-800'
             }`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    recordingState === RecordingState.RECORDING ? 'bg-red-400'
                    : recordingState === RecordingState.PROCESSING ? 'bg-orange-400'
                    : 'bg-emerald-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    recordingState === RecordingState.RECORDING ? 'bg-red-500'
                    : recordingState === RecordingState.PROCESSING ? 'bg-orange-500'
                    : 'bg-emerald-500'
                  }`}></span>
                </span>
                <span className={`text-xs font-medium ${
                  recordingState === RecordingState.RECORDING ? 'text-red-400'
                  : recordingState === RecordingState.PROCESSING ? 'text-orange-400'
                  : 'text-slate-500'
                }`}>
                  {recordingState === RecordingState.RECORDING ? 'Мікрофон'
                   : recordingState === RecordingState.PROCESSING ? 'Обробка...'
                   : 'Готово'}
                </span>
             </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Settings size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full px-4 lg:px-6" ref={topOfListRef}>
        
        {/* Dictionary List (Full Width) */}
        <div className="flex flex-col w-full mx-auto mt-4">
             <div className="flex items-center justify-between mb-2 px-1 z-30 bg-slate-950 py-2">
              <div className="flex items-center gap-4">
                 <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  Словник <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-300">{dictionary.length}</span>
                </h2>
                
                {dictionary.length > 0 && (
                   <button 
                    onClick={() => setIsGlobalBlur(!isGlobalBlur)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isGlobalBlur 
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {isGlobalBlur ? (
                      <>
                        <EyeOff size={14} />
                        <span>Режим вивчення</span>
                      </>
                    ) : (
                      <>
                        <Eye size={14} />
                        <span>Показати все</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {dictionary.length > 0 && (
                <button 
                  onClick={() => {
                    if(confirm("Очистити історію?")) setDictionary([]);
                  }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors hover:underline"
                >
                  Очистити
                </button>
              )}
             </div>

             <div className="space-y-3 pb-20">
                {dictionary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 py-24 text-center">
                    <div className="mb-6 rounded-full bg-slate-800/50 p-6 text-slate-700 ring-1 ring-slate-800">
                      <Book size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-300">Словник порожній</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
                      Натисніть на мікрофон та скажіть слово.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {dictionary.map((entry) => (
                      <DictionaryCard 
                        key={entry.id} 
                        entry={entry} 
                        onDelete={handleDeleteEntry}
                        globalBlur={isGlobalBlur}
                      />
                    ))}
                  </div>
                )}
             </div>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />
    </div>
  );
};

export default App;