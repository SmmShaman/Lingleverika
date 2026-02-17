import React from 'react';
import { X, RefreshCw } from 'lucide-react';
import { AppSettings } from '../types';
import { LANGUAGES, DEFAULT_SYSTEM_PROMPT } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const handleResetPrompt = () => {
    if (confirm("Скинути системну інструкцію до стандартної?")) {
      onUpdateSettings({ ...settings, systemPrompt: DEFAULT_SYSTEM_PROMPT });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-slate-800 p-6 shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-100">Налаштування</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Оригінальна мова</label>
              <select
                value={settings.sourceLang}
                onChange={(e) => onUpdateSettings({ ...settings, sourceLang: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
              >
                {LANGUAGES.map((lang) => (
                  <option key={`source-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Мова перекладу</label>
              <select
                value={settings.targetLang}
                onChange={(e) => onUpdateSettings({ ...settings, targetLang: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
              >
                {LANGUAGES.filter(l => l.code !== 'auto').map((lang) => (
                  <option key={`target-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400">Системний промпт</label>
              <button 
                onClick={handleResetPrompt}
                className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300"
              >
                <RefreshCw size={10} /> Скинути
              </button>
            </div>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => onUpdateSettings({ ...settings, systemPrompt: e.target.value })}
              className="w-full h-32 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none resize-none"
              placeholder="Налаштуйте, як ШІ повинен пояснювати слова..."
            />
            <p className="mt-1 text-xs text-slate-500">
              Ця інструкція використовується спільно з вибраними мовами.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;