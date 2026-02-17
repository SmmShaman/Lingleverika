import React, { useState, useEffect } from 'react';
import { Trash2, Volume2, Eye, EyeOff } from 'lucide-react';
import { WordEntry } from '../types';

interface DictionaryCardProps {
  entry: WordEntry;
  onDelete: (id: string) => void;
  globalBlur: boolean;
}

const DictionaryCard: React.FC<DictionaryCardProps> = ({ entry, onDelete, globalBlur }) => {
  const [isBlurred, setIsBlurred] = useState(globalBlur);

  useEffect(() => {
    setIsBlurred(globalBlur);
  }, [globalBlur]);

  const toggleBlur = () => setIsBlurred(!isBlurred);

  const handleSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(entry.original);
    window.speechSynthesis.speak(utterance);
  };

  const highlightTerm = (text: string, term: string) => {
    if (!term || !text) return text;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() ? 
        <span key={i} className="text-orange-300 font-semibold">{part}</span> : 
        part
    );
  };

  const blurClass = isBlurred ? "blur-sm select-none bg-slate-700/50 text-transparent rounded transition-all duration-300" : "transition-all duration-300";

  return (
    <div className="group relative rounded-lg bg-slate-800/40 border border-slate-700/50 p-3 hover:bg-slate-800/80 hover:border-orange-500/30 transition-all">
      
      {/* Top Section: Word Info + Actions */}
      <div className="flex justify-between items-start gap-4">
        
        {/* Left: Content */}
        <div className="flex-1 min-w-0">
          
          {/* Row 1: Word + Phonetic */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white leading-none">{entry.original}</h3>
            {entry.phonetic && (
              <span className="text-xs text-slate-500 font-mono">/{entry.phonetic}/</span>
            )}
          </div>

          {/* Row 2: Synonyms (Compact) */}
          {entry.synonyms.length > 0 && (
            <div className={`text-[10px] text-slate-500 mt-0.5 leading-tight ${blurClass}`}>
              {entry.synonyms.join(', ')}
            </div>
          )}

          {/* Row 3: Translation + Explanation (Inline) */}
          <div className="mt-1.5 leading-tight">
            <span className={`font-bold text-emerald-400 mr-2 ${blurClass}`}>
               {entry.translation}
            </span>
            <span className={`text-sm text-slate-400 ${blurClass}`}>
              {entry.explanation}
            </span>
          </div>
        </div>

        {/* Right: Actions (Smaller buttons) */}
        <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button 
            onClick={toggleBlur}
            className="p-1.5 text-slate-500 hover:text-orange-400 hover:bg-slate-700 rounded transition-colors"
          >
            {isBlurred ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button 
            onClick={handleSpeak}
            className="p-1.5 text-slate-500 hover:text-orange-400 hover:bg-slate-700 rounded transition-colors"
          >
            <Volume2 size={14} />
          </button>
          <button 
            onClick={() => onDelete(entry.id)}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Footer: Compact Examples */}
      {entry.examples && entry.examples.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/30">
          <ul className="space-y-1">
            {entry.examples.map((ex, idx) => (
              <li key={idx} className="text-xs leading-tight flex flex-wrap gap-x-2">
                <span className="text-slate-300 italic">
                  {typeof ex === 'string' ? highlightTerm(ex, entry.original) : highlightTerm(ex.original, entry.original)}
                </span>
                <span className={`text-slate-500 ${blurClass}`}>
                  — {typeof ex === 'string' ? "" : ex.translation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DictionaryCard;