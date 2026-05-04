"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// NOTE: This repo's scheduler/auth backend is optional in "Completed integration".
// The UI still expects an auth context (login/register/logout) so we provide a
// small local-auth implementation that works without any server.

export type AuthUser = {
  user_id: string;
  display_name?: string;
  email?: string;
};

type AuthResult = { error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "intentlock_auth_v1";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function makeToken(userId: string): string {
  // Not a real JWT; just a stable opaque value for demo purposes.
  return `local-${userId}-${Date.now()}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = safeJsonParse<{ user: AuthUser; token: string }>(
      window.localStorage.getItem(STORAGE_KEY)
    );
    if (stored?.user && stored?.token) {
      setUser(stored.user);
      setToken(stored.token);
    }
    setLoading(false);
  }, []);

  const persist = useCallback((nextUser: AuthUser | null, nextToken: string | null) => {
    if (typeof window === "undefined") return;
    if (!nextUser || !nextToken) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }));
  }, []);

  const login = useCallback(async (email: string, _password: string): Promise<AuthResult> => {
    // Accept any credentials; treat email prefix as user id.
    const userId = (email || "user").split("@")[0] || "user";
    const nextUser: AuthUser = { user_id: userId, email };
    const nextToken = makeToken(userId);
    setUser(nextUser);
    setToken(nextToken);
    persist(nextUser, nextToken);
    return {};
  }, [persist]);

  const register = useCallback(async (email: string, password: string, displayName?: string): Promise<AuthResult> => {
    if (!password || password.length < 6) return { error: "Password must be at least 6 characters." };
    const userId = (email || "user").split("@")[0] || "user";
    const nextUser: AuthUser = { user_id: userId, email, display_name: displayName };
    const nextToken = makeToken(userId);
    setUser(nextUser);
    setToken(nextToken);
    persist(nextUser, nextToken);
    return {};
  }, [persist]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    persist(null, null);
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    login,
    register,
    logout,
  }), [user, token, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
