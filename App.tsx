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
  const recognitionRef = useRef<any>(null);
  const isRestartingRef = useRef(false);
  const lastActivityRef = useRef<number>(0);
  const recordingStateRef = useRef<RecordingState>(RecordingState.IDLE); // Fix stale closures
  const topOfListRef = useRef<HTMLDivElement>(null);
  
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

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true; 
    }
  }, []);

  // Update language when settings change
  useEffect(() => {
    if (recognitionRef.current && settings.sourceLang) {
      recognitionRef.current.lang = settings.sourceLang === 'auto' ? 'en-US' : settings.sourceLang;
    }
  }, [settings.sourceLang]);


  // Audio Recording (Speech-to-Text) Logic
  const startRecording = () => {
    if (!recognitionRef.current) {
      alert("Ваш браузер не підтримує розпізнавання мови.");
      return;
    }

    try {
      setTextInput(""); 
      isRestartingRef.current = false;
      recognitionRef.current.start();
      setRecordingState(RecordingState.RECORDING);

      // Start the shutdown timer logic (60s)
      resetShutdownTimer();

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const currentText = finalTranscript || interimTranscript;
        
        // Update UI
        setTextInput(currentText);

        // Logic:
        // 1. Reset the "Auto-Shutdown" timer because we have activity.
        resetShutdownTimer();
        
        // 2. Clear any pending submit timer
        if (submitTimerRef.current) clearTimeout(submitTimerRef.current);

        const trimmedText = currentText.trim();
        if (trimmedText.length > 0) {
           // Rule: If > 5 words, submit immediately
           const wordCount = trimmedText.split(/\s+/).filter(w => w.length > 0).length;
           
           if (wordCount > 5) {
               handleProcessInput(currentText);
               return;
           }

           // Rule: If pause > 3s, submit
           submitTimerRef.current = setTimeout(() => {
              handleProcessInput(currentText); 
           }, 3000); 
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        
        // If restarting, ignore abort error
        if (isRestartingRef.current && event.error === 'aborted') return;

        if (event.error === 'not-allowed') {
           alert("Доступ до мікрофону заборонено.");
        }
        
        // Only stop on fatal errors, otherwise let onend handle restart logic
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
           stopRecording();
        }
      };

      recognitionRef.current.onend = () => {
         // Auto-restart logic:
         // If the app thinks we should still be recording, restart the service.
         // This handles cases where the browser stops listening due to silence or network hiccups.
         if (recordingStateRef.current === RecordingState.RECORDING) {
             
             // Reset manual restart flag if it was used
             if (isRestartingRef.current) {
                 isRestartingRef.current = false;
             }

             try {
                console.log("Auto-restarting speech recognition...");
                recognitionRef.current.start();
             } catch (e) {
                console.error("Failed to auto-restart speech recognition", e);
                setRecordingState(RecordingState.IDLE);
             }
             return;
         }

         // If we are not in RECORDING state (e.g., user clicked Stop), set IDLE.
         setRecordingState(RecordingState.IDLE);
      };

    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setRecordingState(RecordingState.ERROR);
    }
  };

  const stopRecording = () => {
    // Immediately update ref to prevent race condition in onend
    recordingStateRef.current = RecordingState.IDLE;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
      
    // Clear timers
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    if (shutdownIntervalRef.current) clearInterval(shutdownIntervalRef.current);

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

    // Reset the shutdown timer to 60s immediately upon submission
    if (recordingStateRef.current === RecordingState.RECORDING) {
      resetShutdownTimer();
    }

    try {
      // 1. Send to API (Async)
      analyzeInput(input, settings).then(result => {
         setDictionary(prev => [result, ...prev]);
         // Scroll to top to focus on new word
         window.scrollTo({ top: 0, behavior: 'smooth' });
      }).catch(err => console.error("Processing failed", err));
      
      // 2. Clear input immediately for UX
      if (typeof input === 'string') {
        setTextInput(""); 
        
        // 3. Restart Recognition to clear buffer
        if (recognitionRef.current && recordingStateRef.current === RecordingState.RECORDING) {
            isRestartingRef.current = true;
            recognitionRef.current.stop();
            // onend will handle the actual start() call
        }
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