"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NavigationTransitionContextValue = {
  exitingTo: string | null;
  startExit: (href: string) => void;
};

const NavigationTransitionContext = createContext<NavigationTransitionContextValue | null>(null);

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const [exitingTo, setExitingTo] = useState<string | null>(null);
  const exitTimer = useRef<number | null>(null);

  const startExit = useCallback((href: string) => {
    setExitingTo(href);
    // The UI contains CSS exit animations; give them a short head-start.
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => {
      // Consumers handle navigation after setting exitingTo.
      // We just clear the flag if nothing navigated.
      setExitingTo(null);
    }, 450);
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

  const value = useMemo<NavigationTransitionContextValue>(() => ({ exitingTo, startExit }), [exitingTo, startExit]);

  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition(): NavigationTransitionContextValue {
  const ctx = useContext(NavigationTransitionContext);
  if (!ctx) throw new Error("useNavigationTransition must be used within NavigationTransitionProvider");
  return ctx;
}
