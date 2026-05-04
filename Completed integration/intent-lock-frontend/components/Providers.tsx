"use client";

import { AuthProvider } from "../lib/authContext";
import { NavigationTransitionProvider } from "../lib/navigationTransitionContext";
import { EstimatorProvider } from "./providers/EstimatorProvider";
import { ToastProvider } from "./ToastProvider";
import { AuthGuard } from "./AuthGuard";
import { AuthBar } from "./AuthBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationTransitionProvider>
        <EstimatorProvider>
          <ToastProvider>
            <AuthBar />
            <AuthGuard>{children}</AuthGuard>
          </ToastProvider>
        </EstimatorProvider>
      </NavigationTransitionProvider>
    </AuthProvider>
  );
}
