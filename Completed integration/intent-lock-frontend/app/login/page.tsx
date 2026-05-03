"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/authContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = isRegister
        ? await register(email, password, displayName || undefined)
        : await login(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium text-foreground">
            IntentLock | Adaptive Scheduler
          </h1>
          <p className="text-muted-foreground mt-1">
            Sign in to start your session
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            {isRegister && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Display name (optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-input bg-input-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-input bg-input-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-input bg-input-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
              {isRegister && (
                <p className="text-xs text-muted-foreground mt-1">
                  At least 6 characters
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border px-8 py-4 transition-opacity disabled:opacity-70"
              style={{
                backgroundColor: "rgba(143, 191, 224, 0.2)",
                borderColor: "rgba(143, 191, 224, 0.4)",
                color: "#8FBFE0",
              }}
            >
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {isRegister ? "Already have an account? Sign in" : "Create an account"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Back to app
          </Link>
        </p>
      </div>
    </main>
  );
}
