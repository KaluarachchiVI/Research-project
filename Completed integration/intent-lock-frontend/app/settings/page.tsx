"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6 rounded-[1.25rem] border border-border bg-card p-8 shadow-lg">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Settings UI is temporarily unavailable in this merge state.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80"
          >
            Back to Home
          </Link>
          <Link
            href="/console"
            className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80"
          >
            Open Console
          </Link>
        </div>
      </div>
    </main>
  );
}
