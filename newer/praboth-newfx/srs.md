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
- **REQ-CLE-12**: The system shall record a "Distraction Period" only if the non-study context persists for longer than a configurable threshold (default: **3 minutes**).
- **REQ-CLE-13**: To preserve privacy, the system **shall not** store the plaintext names of non-study apps or windows; only start/end times shall be recorded.

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

### 4. System Interface

- **Input**: JSON-based event stream via internal Event Bus.
- **Output**: Real-time broadcast of `RuntimeEstimate` objects containing:
  - `load` (float): Scalar estimate.
  - `load_state` (string): "low", "medium", "high".
  - `confidence` (float): Inverse variance.
