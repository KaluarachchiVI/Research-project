"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchConsentHistory,
  fetchPermissions,
  updateConsent,
  updateContextBlocklist,
  updateIdleBlock,
  updatePrivacy,
  type ConsentEntry,
  type PermissionsStatus,
} from "@/lib/api";

const IDLE_MAX = 86_400;
const IDLE_PRESETS = [0, 60, 300, 900, 3600] as const;

function parseBlocklistText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000",
    []
  );

  const [permissions, setPermissions] = useState<PermissionsStatus | null>(
    null
  );
  const [blocklistDraft, setBlocklistDraft] = useState("");
  const [idleDraft, setIdleDraft] = useState("0");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [consentHistory, setConsentHistory] = useState<ConsentEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refreshPermissions = useCallback(async () => {
    setLoadError(null);
    const p = await fetchPermissions();
    setPermissions(p);
    setBlocklistDraft(p.context_blocklist.join("\n"));
    setIdleDraft(String(p.idle_block_seconds ?? 0));
    return p;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await refreshPermissions();
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Could not reach cognitive load API."
          );
          setPermissions(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPermissions]);

  const loadHistory = useCallback(async () => {
    try {
      const entries = await fetchConsentHistory(30);
      setConsentHistory(entries);
    } catch {
      setConsentHistory([]);
    }
  }, []);

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen, loadHistory]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setActionError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Request failed. Is the CLE backend running?"
      );
    } finally {
      setBusy(null);
    }
  };

  const onToggleConsent = (granted: boolean) =>
    run("consent", async () => {
      const p = await updateConsent(granted);
      setPermissions(p);
      setBlocklistDraft(p.context_blocklist.join("\n"));
      setIdleDraft(String(p.idle_block_seconds ?? 0));
    });

  const onTogglePrivacyPause = (privacyPause: boolean) =>
    run("privacy", async () => {
      const p = await updatePrivacy(privacyPause);
      setPermissions(p);
      setBlocklistDraft(p.context_blocklist.join("\n"));
      setIdleDraft(String(p.idle_block_seconds ?? 0));
    });

  const onSaveBlocklist = () =>
    run("blocklist", async () => {
      const entries = parseBlocklistText(blocklistDraft);
      const p = await updateContextBlocklist(entries);
      setPermissions(p);
      setBlocklistDraft(p.context_blocklist.join("\n"));
      setIdleDraft(String(p.idle_block_seconds ?? 0));
    });

  const onSaveIdle = () =>
    run("idle", async () => {
      const n = parseInt(idleDraft, 10);
      if (!Number.isFinite(n) || n < 0 || n > IDLE_MAX) {
        throw new Error(`Idle threshold must be between 0 and ${IDLE_MAX} seconds.`);
      }
      const p = await updateIdleBlock(n);
      setPermissions(p);
      setBlocklistDraft(p.context_blocklist.join("\n"));
      setIdleDraft(String(p.idle_block_seconds ?? 0));
    });

  const addCatalogToken = (token: string) => {
    const t = token.trim();
    if (!t) return;
    const lines = parseBlocklistText(blocklistDraft);
    if (lines.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setBlocklistDraft([...lines, t].join("\n"));
  };

  return (
    <main className="min-h-screen bg-background p-6 text-foreground sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Privacy, consent, and context rules for the on-device cognitive load
              estimator (CLE).
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              API: {apiBase}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/90"
            >
              Dashboard
            </Link>
            <Link
              href="/focus-setup"
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              Focus setup
            </Link>
          </div>
        </header>

        {loading && (
          <p className="text-sm text-muted-foreground">Loading permissions…</p>
        )}

        {loadError && (
          <div
            className="rounded-[1.25rem] border border-[var(--destructive)]/40 bg-[var(--color-error-bg)] p-4 text-sm text-foreground"
            role="alert"
          >
            <p className="font-medium text-[var(--destructive)]">
              Cannot load settings
            </p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
            <button
              type="button"
              className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                setLoading(true);
                void refreshPermissions()
                  .catch((e) =>
                    setLoadError(
                      e instanceof Error
                        ? e.message
                        : "Could not reach cognitive load API."
                    )
                  )
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <p
            className="rounded-xl border border-[var(--destructive)]/30 bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--destructive)]"
            role="status"
          >
            {actionError}
          </p>
        )}

        {permissions && !loading && (
          <>
            <section className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Data collection
              </h2>
              <div className="mt-4 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Research consent</p>
                    <p className="text-sm text-muted-foreground">
                      When off, interaction events are not used for load estimation or
                      prompts.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void onToggleConsent(true)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        permissions.consent_granted
                          ? "border-2 border-[var(--cognitive-load)] bg-[var(--cognitive-load)] text-white"
                          : "border border-border bg-secondary/40 text-foreground hover:bg-secondary/70"
                      } disabled:opacity-50`}
                    >
                      {busy === "consent" ? "…" : "On"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void onToggleConsent(false)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        !permissions.consent_granted
                          ? "border-2 border-[var(--destructive)] bg-[var(--destructive)]/15 text-[var(--destructive)]"
                          : "border border-border bg-secondary/40 text-foreground hover:bg-secondary/70"
                      } disabled:opacity-50`}
                    >
                      {busy === "consent" ? "…" : "Off"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Privacy pause</p>
                    <p className="text-sm text-muted-foreground">
                      Temporarily pause sensing and EMA scheduling (e.g. sensitive
                      windows).
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void onTogglePrivacyPause(false)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        !permissions.privacy_pause
                          ? "border-2 border-[var(--cognitive-load)] bg-[var(--cognitive-load)]/15 text-[var(--cognitive-load)]"
                          : "border border-border bg-secondary/40 text-foreground hover:bg-secondary/70"
                      } disabled:opacity-50`}
                    >
                      {busy === "privacy" ? "…" : "Active"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void onTogglePrivacyPause(true)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        permissions.privacy_pause
                          ? "border-2 border-[var(--warning)] bg-[var(--warning)]/25 text-foreground"
                          : "border border-border bg-secondary/40 text-foreground hover:bg-secondary/70"
                      } disabled:opacity-50`}
                    >
                      {busy === "privacy" ? "…" : "Paused"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Context blocklist
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One token per line (case-insensitive). If the current context matches a
                token, keyboard/mouse events are dropped for estimation.
              </p>
              {permissions.context_catalog &&
                permissions.context_catalog.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {permissions.context_catalog.slice(0, 24).map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => addCatalogToken(c)}
                        className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                )}
              <textarea
                className="mt-4 min-h-[140px] w-full rounded-xl border border-border bg-input-background p-3 font-mono text-sm text-foreground outline-none ring-ring focus-visible:ring-2"
                value={blocklistDraft}
                onChange={(e) => setBlocklistDraft(e.target.value)}
                disabled={busy !== null}
                spellCheck={false}
                aria-label="Context blocklist, one entry per line"
              />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onSaveBlocklist()}
                className="mt-3 rounded-xl border border-[var(--cognitive-load)] bg-[var(--cognitive-load)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === "blocklist" ? "Saving…" : "Save blocklist"}
              </button>
            </section>

            <section className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Idle threshold
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                If idle time (from system context) exceeds this many seconds, new
                interaction events are ignored. Set to 0 to disable.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Seconds (0–{IDLE_MAX})</span>
                  <input
                    type="number"
                    min={0}
                    max={IDLE_MAX}
                    className="w-40 rounded-xl border border-border bg-input-background px-3 py-2 font-mono text-sm outline-none ring-ring focus-visible:ring-2"
                    value={idleDraft}
                    onChange={(e) => setIdleDraft(e.target.value)}
                    disabled={busy !== null}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {IDLE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setIdleDraft(String(s))}
                      className="rounded-lg border border-border bg-secondary/30 px-2 py-1 text-xs hover:bg-secondary/60 disabled:opacity-50"
                    >
                      {s === 0 ? "0" : `${s}s`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onSaveIdle()}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {busy === "idle" ? "Saving…" : "Save idle rule"}
                </button>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-border bg-card p-6 shadow-lg">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Consent history
                </h2>
                <span className="text-xs text-muted-foreground">
                  {historyOpen ? "Hide" : "Show"}
                </span>
              </button>
              {historyOpen && (
                <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
                  {consentHistory.length === 0 ? (
                    <li className="text-muted-foreground">No entries yet.</li>
                  ) : (
                    consentHistory.map((e, i) => (
                      <li
                        key={`${e.timestamp}-${i}`}
                        className="flex justify-between gap-2 border-b border-border/60 py-1 font-mono text-xs"
                      >
                        <span className="text-muted-foreground">{e.timestamp}</span>
                        <span
                          className={
                            e.granted ? "text-[var(--cognitive-load)]" : "text-muted-foreground"
                          }
                        >
                          {e.granted ? "granted" : "revoked"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
