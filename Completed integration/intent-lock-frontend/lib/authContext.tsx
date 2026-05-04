"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "intentlock_dev_auth_v1";

export type AuthUser = {
  user_id: string;
  display_name: string;
};

type AuthResult = { error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<AuthResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.user_id === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = readStoredUser();
    if (u) {
      setUser(u);
      setToken("dev-local");
    }
    setLoading(false);
  }, []);

  const persist = useCallback((u: AuthUser | null) => {
    if (!u) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { error: "Email is required." };
    const local = trimmed.split("@")[0] || "user";
    const u: AuthUser = {
      user_id: trimmed,
      display_name: local.replace(/[._]/g, " "),
    };
    setUser(u);
    setToken("dev-local");
    persist(u);
    return {};
  }, [persist]);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const base = await login(email, password);
      if (base.error) return base;
      if (displayName?.trim()) {
        setUser((prev) => {
          if (!prev) return prev;
          const next = { ...prev, display_name: displayName.trim() };
          persist(next);
          return next;
        });
      }
      return {};
    },
    [login, persist]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    persist(null);
  }, [persist]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
