import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LOCALES, messages } from './messages';

const STORAGE_KEY = 'rift-locale';
const LocaleContext = createContext(null);

function lookup(dict, path) {
  return String(path || '').split('.').reduce((node, key) => (
    node && typeof node === 'object' ? node[key] : undefined
  ), dict);
}

function fill(template, vars) {
  if (!vars) return template;
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? `{${key}}` : String(vars[key])
  ));
}

function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && messages[saved]) return saved;
  } catch { /* ignore */ }
  const nav = String(typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('pl')) return 'pl';
  return 'en';
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next) => {
    const id = messages[next] ? next : 'en';
    setLocaleState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    if (typeof document !== 'undefined') document.documentElement.lang = id;
  }, []);

  const t = useCallback((key, vars) => {
    const raw = lookup(messages[locale], key) ?? lookup(messages.en, key) ?? key;
    return fill(raw, vars);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, locales: LOCALES }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n must be used inside <LocaleProvider>');
  return ctx;
}

export { LOCALES };
