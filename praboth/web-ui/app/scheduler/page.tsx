"use client";

import { Surface } from "../components/Surface";
import styles from "./page.module.css";

export default function SchedulerPage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.container} container-dashboard`}>
        <Surface padding="lg" className="surface">
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Adaptive scheduler</p>
              <h1 className={styles.title}>Work/break scheduling</h1>
              <p className={styles.subhead}>
                Intelligent scheduling powered by real-time cognitive load from praboth.
              </p>
            </div>
          </div>
        </Surface>

        <Surface padding="none" className="surface" style={{ minHeight: "80vh" }}>
          <iframe
            src="http://127.0.0.1:5000/static/dashboard.html"
            className={styles.iframe}
            title="Adaptive Scheduler Dashboard"
            allow="clipboard-read; clipboard-write"
          />
        </Surface>
      </div>
    </main>
  );
}

