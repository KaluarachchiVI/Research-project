"use client";

import Link from "next/link";
import { WorkspacePanel, RuntimeSnapshot, NavigationPanel } from "../../components/home";
import styles from "./advanced.module.css";

export default function AdvancedDetails() {
  return (
    <main className={styles.advancedPage}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Runtime · Advanced</p>
            <h1 className={styles.title}>Advanced Details</h1>
            <p className={styles.lead}>Runtime snapshot, active contexts, cooldowns, and policy counters.</p>
          </div>
          <div className={styles.actions}>
            <Link href="/console" className={styles.button}>Telemetry Console</Link>
            <Link href="/settings" className={styles.button}>Policy Settings</Link>
          </div>
        </header>

        <section className={styles.columns}>
          <aside className={styles.navCol}>
            <NavigationPanel />
          </aside>

          <div className={styles.contentCol}>
            <div className={styles.cardRow}>
              <RuntimeSnapshot />
            </div>

            <div className={styles.cardRow}>
              <WorkspacePanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
