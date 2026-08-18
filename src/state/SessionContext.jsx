import React, { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'rift-session';
const SessionContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('gd-session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [session, setSessionState] = useState(readStored);

  const setSession = useCallback((next) => {
    setSessionState(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

// session shape: { gameName, tagLine, region, platform } | null
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
