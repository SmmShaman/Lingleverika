import React, { useState } from 'react';
import { Globe, ArrowRight, Languages } from 'lucide-react';
import { AppSettings } from '../types';
import { LANGUAGES, DEFAULT_SETTINGS } from '../constants';

interface SetupScreenProps {
  onComplete: (settings: AppSettings) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [sourceLang, setSourceLang] = useState<string>('no'); // Default to Norwegian
  const [targetLang, setTargetLang] = useState<string>('uk'); // Default to Ukrainian

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      ...DEFAULT_SETTINGS,
      sourceLang,
      targetLang,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-200">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-900/50 p-8 shadow-2xl border border-slate-800 backdrop-blur-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 mb-6">
            <Globe size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Вітаємо у NightOwl
          </h1>
          <p className="text-slate-400">
            Ця вкладка слухатиме ваші повторення. Вкажіть мови, щоб налаштувати ШІ.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Languages size={14} /> Мова контенту (Інша вкладка)
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full appearance-none rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-base text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
              >
                {LANGUAGES.map((lang) => (
                  <option key={`source-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Мова відео або подкасту, який ви зараз слухаєте в іншій вкладці.
              </p>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight size={20} className="rotate-90 sm:rotate-0" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Languages size={14} /> Мова перекладу (Ваша рідна)
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full appearance-none rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-base text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
              >
                {LANGUAGES.filter(l => l.code !== 'auto').map((lang) => (
                  <option key={`target-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="group w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-[1.02] transition-all duration-200"
          >
            Розпочати сесію
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;