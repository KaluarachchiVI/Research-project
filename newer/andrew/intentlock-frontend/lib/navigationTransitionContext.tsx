"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface NavigationTransitionContextValue {
  /** Target path the app is animating towards, or null when idle. */
  exitingTo: string | null;
  /** Begin an exit animation, then navigate to `href` once it completes. */
  startExit: (href: string) => void;
}

const NavigationTransitionContext =
  createContext<NavigationTransitionContextValue | null>(null);

// Keep this in sync with .page-exit-* / .modal-exit CSS animation durations
// in globals.css (typically ~200-300ms). 280ms gives a small safety margin.
const EXIT_ANIMATION_MS = 280;

export function NavigationTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [exitingTo, setExitingTo] = useState<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the exiting state once the route actually changes - this is the
  // signal that navigation completed and the entry animation can take over.
  useEffect(() => {
    if (!exitingTo) return;
    if (pathname === exitingTo) {
      setExitingTo(null);
    }
  }, [pathname, exitingTo]);

  // Safety net: if for any reason the route change never fires (e.g. user
  // navigated to the same page), clear after a generous timeout so we don't
  // get stuck with the exit overlay applied forever.
  useEffect(() => {
    if (!exitingTo) return;
    const t = setTimeout(() => setExitingTo(null), EXIT_ANIMATION_MS + 1500);
    return () => clearTimeout(t);
  }, [exitingTo]);

  const startExit = useCallback(
    (href: string) => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      // Same-route navigation: skip the animation entirely.
      if (href === pathname) {
        setExitingTo(null);
        return;
      }
      setExitingTo(href);
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        router.push(href);
      }, EXIT_ANIMATION_MS);
    },
    [pathname, router],
  );

  // Cleanup any pending push if the provider unmounts (e.g. fast refresh).
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, []);

  const value = useMemo<NavigationTransitionContextValue>(
    () => ({ exitingTo, startExit }),
    [exitingTo, startExit],
  );

  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition(): NavigationTransitionContextValue {
  const ctx = useContext(NavigationTransitionContext);
  if (!ctx) {
    throw new Error(
      "useNavigationTransition must be used inside <NavigationTransitionProvider>",
    );
  }
  return ctx;
}
