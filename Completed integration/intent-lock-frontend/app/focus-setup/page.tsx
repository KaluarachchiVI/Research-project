"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDesktopBridge, type InstalledAppEntry } from "../../lib/desktopBridge";

function appWhitelistValue(entry: InstalledAppEntry): string {
  const hint = entry.exeHint?.trim();
  if (hint && hint.toLowerCase().endsWith(".exe")) return hint.toLowerCase();
  const n = entry.name.trim();
  if (!n) return "";
  return n.toLowerCase().endsWith(".exe") ? n.toLowerCase() : `${n.toLowerCase()}.exe`;
}

export default function FocusSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const blockMinutes = useMemo(() => {
    const b = parseInt(searchParams.get("block") ?? "60", 10);
    return Number.isFinite(b) && b > 0 ? Math.min(b, 24 * 60) : 60;
  }, [searchParams]);

  const [apps, setApps] = useState<InstalledAppEntry[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urlsText, setUrlsText] = useState("github.com\nstackoverflow.com");
  const [restrictWebsites, setRestrictWebsites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setLoadingApps(false);
      setError("Open this page from IntentLock Desktop (Electron). Browser mode has no focus lock.");
      return;
    }
    void bridge.apps
      .list()
      .then((list) => setApps(list))
      .catch(() => setApps([]))
      .finally(() => setLoadingApps(false));
  }, []);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bridge = getDesktopBridge();
    if (!bridge) return;
    if (selected.size === 0) {
      setError("Select at least one allowed application.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const allowedApps = [...selected];
    const allowedUrls = urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await bridge.lockdown.start({
      allowedApps,
      allowedUrls,
      restrictWebsites,
      workMinutes: Math.max(5, Math.min(blockMinutes, 24 * 60)),
      breakMinutes: 5,
      remindersEnabled: true,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace("/?autostart=1");
  };

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-medium">Focus lock setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose apps and sites you are allowed to use during work intervals. Everything else is blocked until a break,
            session end, or an impulsive exit through IntentLock.
          </p>
        </div>

        {!getDesktopBridge() && (
          <Link href="/" className="text-sm text-primary underline">
            Back to home
          </Link>
        )}

        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-medium">Allowed applications</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Session block length (for reminders): ~{blockMinutes} min (from your configuration).
            </p>
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border p-2">
              {loadingApps ? (
                <p className="text-sm text-muted-foreground">Loading installed apps…</p>
              ) : apps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No apps from Get-StartApps. Type isn&apos;t supported here yet — use Desktop logs.</p>
              ) : (
                <ul className="space-y-1">
                  {apps.map((a) => {
                    const key = appWhitelistValue(a);
                    if (!key) return null;
                    return (
                      <li key={`${a.name}-${key}`}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-secondary/50">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggle(key)}
                            className="rounded border-border"
                          />
                          <span className="text-sm">
                            {a.name}{" "}
                            <span className="text-muted-foreground">({key})</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-medium">Allowed sites (hostnames)</h2>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={restrictWebsites}
                onChange={(e) => setRestrictWebsites(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span>
                Restrict websites to the list below during work
                <span className="mt-1 block text-xs text-muted-foreground">
                  When on, only these hosts load in the browser (via system proxy). When off, any site can load; only
                  allowed apps are enforced.
                </span>
              </span>
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              One hostname per line (no https://). Subdomains match automatically (e.g. <code className="text-foreground">github.com</code>{" "}
              allows <code className="text-foreground">gist.github.com</code>).
            </p>
            <textarea
              className="mt-4 min-h-[140px] w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={"example.com\ndocs.python.org"}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting || !getDesktopBridge()}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Starting…" : "Save and start session"}
            </button>
            <Link
              href="/"
              className="rounded-xl border border-border px-6 py-3 text-sm text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
