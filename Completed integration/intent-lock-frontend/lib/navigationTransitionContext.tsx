"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const EXIT_MS = 380;

type NavContextValue = {
  exitingTo: string | null;
  startExit: (href: string) => void;
};

const NavigationTransitionContext = createContext<NavContextValue | null>(
  null
);

export function NavigationTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [exitingTo, setExitingTo] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startExit = useCallback(
    (href: string) => {
      if (!href || exitingTo) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setExitingTo(href);
      router.prefetch(href);
      timerRef.current = setTimeout(() => {
        router.push(href);
        setExitingTo(null);
        timerRef.current = null;
      }, EXIT_MS);
    },
    [router, exitingTo]
  );

  const value = useMemo(
    () => ({ exitingTo, startExit }),
    [exitingTo, startExit]
  );

  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition(): NavContextValue {
  const ctx = useContext(NavigationTransitionContext);
  if (!ctx) {
    throw new Error(
      "useNavigationTransition must be used within NavigationTransitionProvider"
    );
  }
  return ctx;
}
