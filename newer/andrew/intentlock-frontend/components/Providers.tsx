"use client";

import { AuthProvider } from "../lib/authContext";
import { NavigationTransitionProvider } from "../lib/navigationTransitionContext";
import { AuthGuard } from "./AuthGuard";
import { AuthBar } from "./AuthBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationTransitionProvider>
        <AuthBar />
        <AuthGuard>{children}</AuthGuard>
      </NavigationTransitionProvider>
    </AuthProvider>
  );
}
