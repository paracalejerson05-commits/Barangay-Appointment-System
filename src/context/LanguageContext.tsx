import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLocale, type Language, translate } from '../lib/i18n';

interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (message: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const getLanguageStorageKey = (userId: string) => `app_language_${userId}`;

function getStoredLanguage(userId: string): Language {
  try {
    return localStorage.getItem(getLanguageStorageKey(userId)) === 'fil' ? 'fil' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not load the language preference account:', error.message);
        return;
      }
      if (mounted) setUserId(data.session?.user.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user.id || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setLanguageState(userId ? getStoredLanguage(userId) : 'en');
  }, [userId]);

  useEffect(() => {
    document.documentElement.lang = language === 'fil' ? 'fil' : 'en';
  }, [language]);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    if (!userId) return;

    try {
      localStorage.setItem(getLanguageStorageKey(userId), nextLanguage);
    } catch (error) {
      console.error('Could not save the language preference:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{
      language,
      locale: getLocale(language),
      setLanguage,
      t: (message) => translate(language, message)
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
