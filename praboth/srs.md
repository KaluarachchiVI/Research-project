# Software Requirements Specification (SRS)

## Component: Cognitive Load Estimator (CLE)

### 1. Introduction

#### 1.1 Purpose

The purpose of the Cognitive Load Estimator (CLE) is to derive the cognitive state of a user in real-time based on their interaction patterns with the computer. It serves as a background sensing component for the larger Research Project.

#### 1.2 Scope

The CLE is a Python-based service (`cog_py_est`) that runs locally on the user's machine. It ingests low-level input events (keyboard, mouse) and system context (active window), processes them through a mathematical model, and outputs a scalar "Cognitive Load" index and a discrete classification (Low/Medium/High).

### 2. Functional Requirements

#### 2.1 Input Data Acquisition

- **REQ-CLE-01**: The system shall accept a stream of **Keyboard Events** (latency, backspace usage, error rate) without recording actual key content.
- **REQ-CLE-02**: The system shall accept a stream of **Pointer Events** (mouse speed, acceleration, click frequency).
- **REQ-CLE-03**: The system shall accept **System Context Events** (active window title, application name) for context awareness.

#### 2.2 Feature Extraction & Normalization

- **REQ-CLE-04**: The system shall aggregate events into time-based windows (default: 60 seconds).
- **REQ-CLE-05**: The system shall calculate feature vectors (dim=10) including Typing Speed (IKI), Mouse Velocity, and Idle Fraction.
- **REQ-CLE-06**: The system shall normalize input features using a **Rolling Z-Score Normalizer** with Huber clipping to handle outliers.
- **REQ-CLE-07**: The system **must persist** the normalization parameters (mean/variance) across sessions to ensure consistent estimation upon restart.

#### 2.3 Estimation Logic

- **REQ-CLE-08**: The system shall use a **Kalman Filter** to fuse noisy input features into a stable latent load estimate.
- **REQ-CLE-09**: The system shall support **Adaptive Output Scaling**, classifying the load as High (> +1 StdDev), Low (< -1 StdDev), or Medium based on the user's historical baseline.

#### 2.4 Distraction Detection

- **REQ-CLE-10**: The system shall detect "Non-Study" contexts (e.g., Entertainment, Social Media).
- **REQ-CLE-11**: The system shall use an **Intelligent Classifier** (LLM-based with Keyword Fallback) to determine if a context is study-related.
  - **Simple Mode**: Keyword matching on app names (e.g., \"Discord\", \"YouTube\" → non-study).
  - **LLM Mode**: Genkit-based semantic classification via optional AI Service (port 3400).
- **REQ-CLE-12**: The system shall record a "Distraction Period" only if the non-study context persists for longer than an **adaptive threshold**:
  - Base threshold: 180 seconds (3 minutes, configurable).
  - Adaptive formula: `Threshold = Median(history) + 2×StdDev(history)`, clamped to [30s, 600s].
  - Requires minimum 5 samples before adaptation activates.
- **REQ-CLE-13**: To preserve privacy, the system **shall not** store the plaintext names of non-study apps or windows; only start/end times + app name shall be recorded.
  - App names are hashed via SHA256 in classification cache to prevent API call repetition.

#### 2.5 Data Persistence

- **REQ-CLE-14**: The system shall use a local **SQLite** database to store session metadata, aggregated feature windows, and distraction periods.
- **REQ-CLE-15**: The system shall implement a cache for context classification using **SHA256 hashes** of window titles to prevent repeated external API calls while maintaining privacy.

### 3. Non-Functional Requirements

#### 3.1 Privacy

- **NFR-01**: Raw keystroke data (content) shall never be stored or transmitted.
- **NFR-02**: Window titles for non-study contexts shall be hashed before caching; plaintext titles for distractions shall not be persisted.

#### 3.2 Performance

- **NFR-03**: The background service shall consume less than 1% of CPU resources on a standard workstation.
- **NFR-04**: Context classification shall use caching to ensure a response time of <10ms for known contexts.

#### 3.3 Reliability

- **NFR-05**: The system shall handle missing data (e.g., no keyboard activity) by imputing features or increasing the estimate uncertainty (variance), rather than crashing.

### 4. System Architecture & Services

The Praboth system consists of three coordinated services:

| Service | Port | Technology | Role |
|---------|------|-----------|------|
| **Backend (CLE)** | 8000 | Python, FastAPI, SQLite | Core estimation engine, event ingestion, Kalman filtering, policy enforcement |
| **Frontend (Dashboard)** | 3000 | Next.js, React, TypeScript | Real-time UI, telemetry visualization, EMA prompts, distraction history |
| **AI Service** | 3400 | Node.js, Genkit, Google Generative AI | Context categorization (LLM-based, optional; default uses simple keyword matching) |

#### 4.1 Backend (Core Estimation Engine)

- Ingests raw OS events (keyboard, mouse) via `/events` endpoint.
- Maintains 60-second sliding window with 15-second hops.
- Executes feature extraction, normalization, Kalman filtering at each hop.
- Tracks distraction periods via adaptive threshold algorithm.
- Serves real-time estimates, telemetry, and distraction history.
- Logs all data to local SQLite; no network egress of raw data.

#### 4.2 Frontend (Web Dashboard)

- Real-time visualization of cognitive load estimates.
- Displays distraction history (start/end times, app names).
- EMA micro-prompts for user feedback (1-7 scale).
- System health dashboard.
- Settings and configuration UI.

#### 4.3 AI Service (Context Categorization)

- Optional service for advanced context classification.
- Accepts app name/window title; returns study/distraction classification.
- Uses Genkit framework with Google Generative AI (Gemini Pro).
- Implements SHA256 caching for privacy and performance.
- Falls back to simple keyword matching if unavailable.

### 5. System Interface

#### 5.1 API Endpoints (Backend, Port 8000)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health check |
| `/estimate` | GET | Latest cognitive load estimate |
| `/telemetry` | GET | System health and metrics |
| `/events` | POST | Ingest raw OS events |
| `/ema/response` | POST | Submit EMA feedback (1-7 rating) |
| `/distractions` | GET | Query distraction history (limit parameter) |
| `/export/request` | POST | Request data export (requires review token) |
| `/stream/state` | GET | SSE stream for real-time state updates |

#### 5.2 Output Objects

**`RuntimeEstimate` (Cognitive Load)**:
```json
{
  "load": 0.45,
  "load_state": "high",
  "confidence": 0.92,
  "residual": 0.08,
  "timestamp": "2026-04-27T10:15:00Z"
}
```

**`DistractionEvent` (Non-Study Period)**:
```json
{
  "start_time": "2026-04-27T10:00:00Z",
  "end_time": "2026-04-27T10:05:30Z",
  "duration_seconds": 330,
  "app_name": "youtube"
}
```

**`TelemetryMetrics`**:
```json
{
  "session_id": "uuid",
  "event_count": 1250,
  "distraction_count": 3,
  "ema_prompts_shown": 5,
  "ema_responses_collected": 4,
  "api_key_required": true,
  "privacy_mode": false
}
```
