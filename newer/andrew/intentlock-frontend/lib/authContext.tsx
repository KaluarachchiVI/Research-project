"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface AuthUser {
  user_id: string;
  display_name: string;
  email?: string;
}

interface AuthApiResult {
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthApiResult>;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<AuthApiResult>;
  logout: () => void;
}

const SCHEDULER_BASE = (
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000"
).replace(/\/$/, "");

const TOKEN_STORAGE_KEY = "intentlock_token";
const USER_STORAGE_KEY = "intentlock_user";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.user_id === "string") return parsed;
  } catch {
    // fallthrough to null
  }
  return null;
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function persist(token: string | null, user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (user) window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_STORAGE_KEY);
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string") return data.error;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage + verify token via /api/auth/me on mount.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const storedToken = readStoredToken();
    const storedUser = readStoredUser();

    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Optimistically restore so guarded routes don't flicker through /login.
    setToken(storedToken);
    if (storedUser) setUser(storedUser);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SCHEDULER_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          persist(null, null);
          setToken(null);
          setUser(null);
          return;
        }
        const data = (await res.json()) as AuthUser;
        if (data?.user_id) {
          const merged: AuthUser = {
            user_id: data.user_id,
            display_name: data.display_name ?? storedUser?.display_name ?? "",
            email: storedUser?.email,
          };
          setUser(merged);
          persist(storedToken, merged);
        }
      } catch {
        // Network error: keep optimistic state so the user isn't bounced offline.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthApiResult> => {
      try {
        const res = await fetch(`${SCHEDULER_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return { error: await parseError(res) };
        const data = (await res.json()) as AuthUser & { token: string };
        const nextUser: AuthUser = {
          user_id: data.user_id,
          display_name: data.display_name,
          email: data.email,
        };
        persist(data.token, nextUser);
        setToken(data.token);
        setUser(nextUser);
        return {};
      } catch (e) {
        return {
          error:
            e instanceof Error
              ? e.message
              : "Cannot reach the scheduler. Is it running on " +
                SCHEDULER_BASE +
                "?",
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
    ): Promise<AuthApiResult> => {
      try {
        const res = await fetch(`${SCHEDULER_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            display_name: displayName,
          }),
        });
        if (!res.ok) return { error: await parseError(res) };
        const data = (await res.json()) as AuthUser & { token: string };
        const nextUser: AuthUser = {
          user_id: data.user_id,
          display_name: data.display_name,
          email: data.email,
        };
        persist(data.token, nextUser);
        setToken(data.token);
        setUser(nextUser);
        return {};
      } catch (e) {
        return {
          error:
            e instanceof Error
              ? e.message
              : "Cannot reach the scheduler. Is it running on " +
                SCHEDULER_BASE +
                "?",
        };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    persist(null, null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}
