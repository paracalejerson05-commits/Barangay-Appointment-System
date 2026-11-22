import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function LanguagePreference() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
      <div>
        <h4 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">{t('Language preference')}</h4>
        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">{t('Choose the language used across the portal.')}</p>
      </div>
      <div role="group" aria-label={t('Language')} className="inline-flex items-center gap-1 self-start rounded-full border border-[#CBD5E1] bg-[#E2E8F0]/80 p-1 dark:border-slate-700 dark:bg-slate-900/90 sm:self-auto">
        {(['en', 'fil'] as const).map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={language === option}
            onClick={() => setLanguage(option)}
            className={`min-h-[38px] rounded-full px-4 py-2 text-xs font-semibold transition-colors ${language === option
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'}`}
          >
            {option === 'en' ? t('English') : t('Filipino')}
          </button>
        ))}
      </div>
    </div>
  );
}
