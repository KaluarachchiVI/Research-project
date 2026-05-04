"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToasts } from "../../components/ToastProvider";
import {
  PermissionsStatus,
  fetchPermissions,
  subscribeStateStream,
  updateConsent,
  updateContextBlocklist,
  updateIdleBlock,
  updatePrivacy,
  fetchConsentHistory,
  ConsentEntry,
} from "../../lib/api";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { ToggleSetting } from "../../components/settings/ToggleSetting";
import { BlocklistSetting } from "../../components/settings/BlocklistSetting";
import { ConsentSetting } from "../../components/settings/ConsentSetting";
import styles from "./page.module.css";

function uniqueMerge(current: string[], incoming: string[]) {
  const next = new Set(current);
  incoming.forEach((entry) => {
    if (entry) {
      next.add(entry);
    }
  });
  return Array.from(next);
}

function normalizeContextValues(contextFlags: unknown): string[] {
  if (Array.isArray(contextFlags)) {
    return contextFlags.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (contextFlags && typeof contextFlags === "object") {
    return Object.values(contextFlags as Record<string, unknown>).filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
  }
  return [];
}

function secondsToTimeInput(seconds: number): string {
  const safe = Math.max(0, Math.min(86399, seconds));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}

function timeInputToSeconds(value: string): number {
  if (!value) return 0;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
}

function describeDuration(seconds: number): string {
  if (seconds === 0) return "Immediate";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) {
    return `${seconds}s`;
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = (seconds / 3600).toFixed(1);
  return `${hours.replace(/\.0$/, "")} hours`;
}

export default function SettingsPage() {
  const { addToast } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privacyPause, setPrivacyPause] = useState(false);
  const [consentGranted, setConsentGranted] = useState(true);
  const [contextBlocklist, setContextBlocklist] = useState<string[]>([]);
  const [contextOptions, setContextOptions] = useState<string[]>([]);
  const [applicationOptions, setApplicationOptions] = useState<string[]>([]);
  const [contextSaving, setContextSaving] = useState(false);
  const [newContext, setNewContext] = useState("");
  const [idleBlockSeconds, setIdleBlockSeconds] = useState(900);
  const [idleSaving, setIdleSaving] = useState(false);
  const [consentHistory, setConsentHistory] = useState<ConsentEntry[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [permissions, history] = await Promise.all([
        fetchPermissions(),
        fetchConsentHistory(20),
      ]);
      applyPermissionsState(permissions);
      setConsentHistory(history);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load permissions";
      setError(message);
      addToast(message, "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    const disconnect = subscribeStateStream(
      (snapshot) => {
        const contexts = normalizeContextValues(snapshot.telemetry?.context_flags);
        if (contexts.length) {
          setContextOptions((prev) => uniqueMerge(prev, contexts));
        }
        const runningApps = snapshot.telemetry?.running_apps ?? [];
        if (runningApps.length) {
          setApplicationOptions((prev) => uniqueMerge(prev, runningApps));
        }
      },
      () => {
        // Handle error silently
      },
      () => {
        // Connection opened
      }
    );
    return () => disconnect();
  }, []);

  const applyPermissionsState = (state: PermissionsStatus) => {
    setPrivacyPause(state.privacy_pause);
    setConsentGranted(state.consent_granted);
    setContextBlocklist(state.context_blocklist ?? []);
    setContextOptions((prev) =>
      uniqueMerge(prev, [...(state.context_catalog ?? []), ...(state.context_blocklist ?? [])]),
    );
    setApplicationOptions((prev) =>
      uniqueMerge(prev, [...(state.context_catalog ?? []), ...(state.context_blocklist ?? [])]),
    );
    if (typeof state.idle_block_seconds === "number") {
      setIdleBlockSeconds(state.idle_block_seconds);
    }
  };

  const togglePrivacy = async () => {
    try {
      const next = !privacyPause;
      setPrivacyPause(next);
      await updatePrivacy(next);
      addToast(next ? "Privacy pause enabled" : "Privacy pause disabled", "success");
    } catch (err) {
      setPrivacyPause(privacyPause);
      const message = err instanceof Error ? err.message : "Failed to toggle privacy pause";
      setError(message);
      addToast(message, "error");
    }
  };

  const toggleConsent = async () => {
    try {
      const next = !consentGranted;
      setConsentGranted(next);
      await updateConsent(next);
      addToast(next ? "Consent granted" : "Consent revoked", "success");
      // Reload consent history
      const history = await fetchConsentHistory(20);
      setConsentHistory(history);
    } catch (err) {
      setConsentGranted(consentGranted);
      const message = err instanceof Error ? err.message : "Failed to toggle consent";
      setError(message);
      addToast(message, "error");
    }
  };

  const persistContextList = async (list: string[]) => {
    setContextSaving(true);
    try {
      const state = await updateContextBlocklist(list);
      applyPermissionsState(state);
      setError(null);
      addToast("Context guard updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update context guard";
      setError(message);
      addToast(message, "error");
    } finally {
      setContextSaving(false);
    }
  };

  const handleContextToggle = (value: string, enabled: boolean) => {
    const next = enabled
      ? uniqueMerge(contextBlocklist, [value])
      : contextBlocklist.filter((entry) => entry !== value);
    setContextBlocklist(next);
    persistContextList(next);
  };

  const handleAddContext = () => {
    const trimmed = newContext.trim();
    if (!trimmed) return;
    if (contextBlocklist.includes(trimmed)) {
      setNewContext("");
      return;
    }
    const next = [...contextBlocklist, trimmed];
    setContextBlocklist(next);
    setContextOptions(uniqueMerge(contextOptions, [trimmed]));
    setApplicationOptions(uniqueMerge(applicationOptions, [trimmed]));
    setNewContext("");
    persistContextList(next);
  };

  const handleIdlePickerChange = (value: string) => {
    const seconds = Math.max(0, Math.min(86399, timeInputToSeconds(value)));
    setIdleBlockSeconds(seconds);
  };

  const persistIdleBlock = async () => {
    setIdleSaving(true);
    try {
      const state = await updateIdleBlock(idleBlockSeconds);
      applyPermissionsState(state);
      setError(null);
      addToast("Idle guard updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update idle guard";
      setError(message);
      addToast(message, "error");
    } finally {
      setIdleSaving(false);
    }
  };

  const workspaceChips = uniqueMerge(contextOptions, contextBlocklist);
  const applicationChips = uniqueMerge(applicationOptions, contextBlocklist);

  return (
    <main className={styles.settingsPage}>
      <div className={styles.settingsContainer}>
        <header className={styles.settingsHeader}>
          <div>
            <h1 className="text-fluid-3xl font-bold text-primary">Local telemetry settings</h1>
            <p className="mt-2 text-fluid-lg text-secondary leading-relaxed">
              Configure privacy pause, consent, and context-aware suppression rules.
            </p>
          </div>
          <div className={styles.buttonGroup}>
            <Link
              href="/"
              className="rounded-full border border-slate-700/60 px-4 py-2 text-fluid-sm text-secondary hover:bg-slate-800/40 focus-ring"
            >
              Home
            </Link>
            <Link
              href="/console"
              className="rounded-full border border-slate-700/60 px-4 py-2 text-fluid-sm text-secondary hover:bg-slate-800/40 focus-ring"
            >
              Console
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-fluid-sm text-rose-200">
            {error}
          </div>
        )}

        <SettingsSection
          title="Capture permissions"
          description="Toggle telemetry capture and consent requirements. These changes apply immediately across the service."
        >
          <div className={styles.actionRow}>
            <ToggleSetting
              label="Privacy Pause"
              description="Temporarily pause all telemetry data collection"
              checked={privacyPause}
              onChange={togglePrivacy}
              disabled={loading}
              loading={false}
              variant="primary"
            />
            <ToggleSetting
              label="Data Collection Consent"
              description="Grant or revoke consent for data collection"
              checked={consentGranted}
              onChange={toggleConsent}
              disabled={loading}
              loading={false}
              variant="secondary"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Consent Management"
          description="View and manage your consent history and current status"
          status={consentGranted ? "Active" : "Inactive"}
        >
          <ConsentSetting
            granted={consentGranted}
            onToggle={toggleConsent}
            history={consentHistory}
            loading={loading}
            disabled={loading}
          />
        </SettingsSection>

        <SettingsSection
          title="Context guard"
          description="Choose which detected workspaces or applications should pause EMA prompts automatically."
          status={contextSaving ? "Saving..." : `Blocking ${contextBlocklist.length} context${contextBlocklist.length === 1 ? "" : "s"}`}
        >
          <div className={styles.formGrid}>
            <BlocklistSetting
              title="Workspace contexts"
              description="Block prompts when these workspaces are active"
              items={workspaceChips}
              blockedItems={contextBlocklist}
              onToggle={handleContextToggle}
              onAdd={handleAddContext}
              loading={contextSaving}
              emptyMessage="No context signals observed yet."
              placeholder="Add workspace or keyword"
            />

            <BlocklistSetting
              title="Running applications"
              description="Block prompts when these applications are running"
              items={applicationChips}
              blockedItems={contextBlocklist}
              onToggle={handleContextToggle}
              onAdd={handleAddContext}
              loading={contextSaving}
              emptyMessage="Start interacting with your workspace to populate this list."
              placeholder="Add application name"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Idle guard"
          description="Automatically pause prompts when no activity is detected for a custom duration."
          status={`Current threshold: ${describeDuration(idleBlockSeconds)}`}
        >
          <div className={styles.actionRow}>
            <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
              Idle duration
              <input
                type="time"
                step={60}
                min="00:00:00"
                max="23:59:59"
                value={secondsToTimeInput(idleBlockSeconds)}
                onChange={(event) => handleIdlePickerChange(event.target.value)}
                className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                disabled={idleSaving}
              />
            </label>
            <button
              type="button"
              onClick={persistIdleBlock}
              className="rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50 focus-ring"
              disabled={idleSaving}
            >
              {idleSaving ? "Saving..." : "Save idle guard"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Prompts will resume automatically after activity resumes or the idle guard timer expires.
          </p>
        </SettingsSection>
      </div>
    </main>
  );
}
