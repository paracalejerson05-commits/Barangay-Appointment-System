import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getThemeStorageKey = (userId: string) => `app_theme_${userId}`;

function applyResolvedTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = theme === 'dark' ? '#0B1120' : '#F4F7FB';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>('system');

  const setActiveUser = (nextUserId: string | null) => {
    setUserId(nextUserId);
    if (!nextUserId) {
      setThemeState('system');
      return;
    }

    try {
      const saved = localStorage.getItem(getThemeStorageKey(nextUserId));
      setThemeState(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system');
    } catch {
      setThemeState('system');
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setActiveUser(session?.user?.id || null);
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setActiveUser(session?.user?.id || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    try {
      const saved = localStorage.getItem(getThemeStorageKey(userId));
      setThemeState(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system');
    } catch {
      setThemeState('system');
    }
  }, [userId]);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let active: 'light' | 'dark' = 'light';
      if (theme === 'system') {
        active = mediaQuery.matches ? 'dark' : 'light';
      } else {
        active = theme;
      }

      setResolvedTheme(active);
      applyResolvedTheme(active);
    };

    applyTheme();

    const listener = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    const active = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    setResolvedTheme(active);
    applyResolvedTheme(active);
    if (userId) {
      try {
        localStorage.setItem(getThemeStorageKey(userId), mode);
      } catch {
        // The current selection still applies for this session.
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
