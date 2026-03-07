Product
Name: IntentLock | Adaptive Scheduler
Tagline: Real-time work/break scheduling with IntentLock.

Features to support:

Start a time-block session (user ID, task type, chronotype, algorithm, block length).
Live dashboard: timer, cognitive load %, scheduler recommendations, session metrics.
IntentLock: on “end session,” show a modal when exit is predicted “impulsive” (friction: reason dropdown or 3s countdown).
Post-session summary: 8 research metrics + time-block sessions list.
Planner: best time of day, arm breakdown, weekly pattern, hourly intensity.
Audience: Researchers and study participants. Tone: professional, data-rich, trustworthy (no playful or consumer-style UI).

Visual direction (new UI)
Theme: Dark dashboard. Background deep navy/slate (#020617, #0f172a). Cards: slightly lighter surface with subtle border and soft shadow.
Typography: Clean sans (e.g. Inter). Small uppercase labels with letter-spacing; strong section titles; monospace only for IDs/code.
Color: Primary text light (#f8fafc); muted secondary (#94a3b8). Accents: cyan/teal (#06b6d4, #0ea5e9) for primary actions and key metrics; green (#10b981) for success/active; red for errors/impulsive; amber for warnings.
Components: Rounded cards (e.g. 1.25rem), pill buttons and status badges, simple bordered inputs/selects, clear tables/lists. Plenty of whitespace and clear grouping.
Accessibility: Strong contrast, visible focus states, logical heading order.
Pages (new UI structure)
1. Home (/)

Session config (top): Title “Session configuration,” short description, form: User ID, Task type, Chronotype, Algorithm, Block length (min). One primary CTA: “Start Time Block Session.”
Dashboard (after start): Header with “Adaptive Scheduler” / “Real-time work/break scheduling,” status pill (Session Active/Inactive), session ID. Grid of four cards: (1) Timer — big MM:SS, Work/Break mins, Pause, End Session, End Work Interval, Get Recommendation, Start/End Work; (2) Cognitive Load — large %, status text, CLE online/warming/offline, “Simulate activity”; (3) Recommendation — work/break mins + “Scheduler Decision” explanation; (4) Session Metrics — reward, algorithm, epoch, prediction count. Then Exit Logs table: timestamp, IMPULSIVE/GENUINE, friction, session min, load %.
IntentLock modal: Full-screen overlay, centered card “Intent-Lock” + message. Friction 0: “Continue Studying” (green), “Exit Anyway” (red). Friction 1: reason dropdown + optional text, “Cancel” / “Save & Exit.” Friction 2: confirm then 3s countdown + “Cancel.”
2. Summary (/summary)

Header: “Post-session summary,” “Adaptive scheduler metrics,” user/session ID, button “Open full dashboard.”
Grid of 8 metric cards: PG, RPH, AHL, EOI, AUC-BUC, CTU, SPF variance, SVR (label + value or N/A).
“Time-block sessions (current run)” list: session ID, start time, cognitive load, Active/Paused.
CTA: “Plan next block.”
3. Planner (/planner)

Header: “Planning,” “Bandit-informed next study block,” optional “Planned after session <id>,” button “Back to session.”
Four cards: Best time of day; Arm preference breakdown; Weekly pattern; Hour-of-day intensity.
Copy to use (new UI)
Keep these exact or very close: Session configuration; Start Time Block Session; Adaptive Scheduler; Real-time work/break scheduling; Session Active / Session Inactive; Current Timer; Work (min) / Break (min); Pause; Resume; End Session; End Work Interval; End Break Interval; Get Recommendation; Start Session / End Work; Cognitive Load (Praboth Real-time); Simulate activity; Current Recommendation; Scheduler Decision; Session Metrics; Research Metrics (Exit Logs); Intent-Lock; Continue Studying; Exit Anyway; Select a reason; Save & Exit; Confirm Exit; Exiting in X second(s)…; Post-session summary; Adaptive scheduler metrics; Open full dashboard; Research metrics (all 8); Time-block sessions (current run); Plan next block; Planning; Bandit-informed next study block; Back to session; Best time of day; Arm preference breakdown; Weekly pattern; Hour-of-day intensity.

Deliverables
Produce the new UI in Relume: sections and components for Home, Summary, and Planner (and the IntentLock modal) that match the structure and copy above, with the dark dashboard style and clear hierarchy. Name components so they map to: Session configuration, Dashboard header, Timer card, Cognitive Load card, Recommendation card, Session Metrics card, Exit Logs table, IntentLock modal, Summary metrics grid, Time-block sessions list, Planner cards.