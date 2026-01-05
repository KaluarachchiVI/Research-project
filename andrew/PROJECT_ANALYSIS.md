# Intent-Lock System - Complete Project Analysis

## 🎯 System Overview

**Intent-Lock** is an intelligent study assistant system that uses machine learning to detect impulsive exit attempts during study sessions and applies **gradual, adaptive friction** instead of hard blocking. The system respects user agency while helping reduce distractions.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│  ┌──────────────┐         ┌──────────────────────────┐    │
│  │  page.tsx    │────────▶│ IntentLockOverlay.tsx     │    │
│  │  (Main UI)   │         │  (Friction Modal)         │    │
│  └──────────────┘         └──────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP REST API
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  ┌──────────────┐         ┌──────────────────────────┐    │
│  │  main.py     │────────▶│  models/model.py         │    │
│  │  (API Layer) │         │  (ML Predictions)        │    │
│  └──────────────┘         └──────────────────────────┘    │
│         │                           │                      │
│         ▼                           ▼                      │
│  ┌──────────────────────────────────────────┐            │
│  │      data/database.py (SQLite)            │            │
│  │  - Training data                          │            │
│  │  - Exit events                            │            │
│  │  - Exit reasons                           │            │
│  └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Breakdown

### 1. **Frontend Layer** (`intentlock-frontend/`)

#### A. Main Page (`app/page.tsx`)

**Purpose:** Main UI component that simulates a study session

**Key Features:**
- **Session Tracking:**
  - Tracks session duration in real-time (updates every minute)
  - Simulates cognitive load (`latent_mean`) - varies between 0.3-0.8 every 5 seconds
  - Generates unique `session_id` on mount

- **State Management:**
  ```typescript
  - sessionStartTime: When session began
  - sessionMinutes: Current session duration
  - latentMean: Cognitive load (0-1 scale)
  - loading: API call state
  - overlayOpen: Whether friction overlay is visible
  - frictionLevel: Current friction level (0, 1, or 2)
  - exitEventId: Database ID of exit event
  ```

- **Exit Attempt Flow:**
  1. User clicks "Exit Study Session"
  2. Sends POST to `/predict-exit` with `session_minutes`, `latent_mean`, `session_id`
  3. Receives response with `prediction`, `friction_level`, `requires_friction`
  4. **If genuine exit:** Shows alert, allows immediate exit (no overlay)
  5. **If impulsive exit:** Opens overlay with appropriate friction level

**How It Works:**
```typescript
handleExitAttempt() {
  1. Set loading = true
  2. POST /predict-exit with session data
  3. If requires_friction = false → Alert + immediate exit
  4. If requires_friction = true → Open overlay
  5. Set loading = false
}
```

---

#### B. Intent Lock Overlay (`components/IntentLockOverlay.tsx`)

**Purpose:** Full-screen modal that applies friction based on prediction

**Key Features:**
- **Full-screen blocking overlay** (z-index: 9999)
- **Three friction levels** with different UI states
- **State management** for reason selection, countdown, etc.

**Friction Level 0: Gentle Reminder**
```
UI: Two buttons
- "Continue Studying" (green) → Closes overlay, continues session
- "Exit Anyway" (red) → Closes overlay, allows exit
```

**Friction Level 1: Reason Required**
```
UI: Dropdown + Optional textarea
- User MUST select reason (fatigue, distraction, boredom, task_completed, other)
- If "other" → Shows textarea for custom text
- "Cancel" button → Closes overlay, continues session
- "Save & Exit" button → POSTs to /log-reason, then exits
```

**Friction Level 2: Strong Confirmation**
```
UI: Countdown timer
- "Confirm Exit" button → Starts 3-second countdown
- Countdown displays: "3... 2... 1..."
- "Cancel" button available during countdown
- Auto-exits after countdown completes
```

**How It Works:**
```typescript
1. Receives props: frictionLevel, message, exitEventId
2. Renders appropriate UI based on frictionLevel
3. If Level 1: User must select reason before exit
4. If Level 2: User must confirm and wait for countdown
5. Calls onExit() or onContinue() based on user action
```

---

### 2. **Backend Layer** (`intentlock-backend/`)

#### A. API Server (`main.py`)

**Purpose:** FastAPI server that handles predictions and logging

**Endpoints:**

**1. `GET /` - Health Check**
```python
Returns: {"message": "Intent-Lock Backend is running"}
```

**2. `POST /predict-exit` - Main Prediction Endpoint**

**Request:**
```json
{
  "session_minutes": 45.0,
  "latent_mean": 0.75,
  "session_id": "session_1234567890"
}
```

**Response:**
```json
{
  "prediction": "impulsive" | "genuine",
  "friction_level": 0 | 1 | 2,
  "message": "Custom message",
  "exit_event_id": 123,
  "requires_friction": true | false
}
```

**Logic Flow:**
```python
1. Call model.predict(session_minutes, latent_mean)
   → Returns 0 (genuine) or 1 (impulsive)

2. If prediction = "impulsive":
   a. Count previous impulsive exits for this session_id
   b. Determine friction level:
      - 0 previous → friction_level = 0 (gentle reminder)
      - 1 previous → friction_level = 1 (reason required)
      - 2+ previous → friction_level = 2 (countdown)
   c. Set requires_friction = True

3. If prediction = "genuine":
   a. friction_level = 0
   b. requires_friction = False (immediate exit)

4. Log exit event to database
5. Return response with all data
```

**3. `POST /log-reason` - Reason Logging**

**Request:**
```json
{
  "exit_event_id": 123,
  "reason": "boredom",
  "custom_text": "Optional text" | null
}
```

**Response:**
```json
{
  "status": "saved",
  "message": "Reason logged successfully"
}
```

**Purpose:** Stores user-provided exit reasons for analysis and future model improvement

---

#### B. Machine Learning Model (`models/model.py`)

**Purpose:** Binary classifier that predicts exit intent

**Algorithm:** Logistic Regression (scikit-learn)

**Features:**
- `session_minutes`: Duration of study session (5-120 minutes)
- `latent_mean`: Cognitive load score (0-1 scale)

**Output:**
- `0` = Genuine exit (productive, task completed)
- `1` = Impulsive exit (distraction, overwhelmed)

**Initialization Flow:**
```python
1. Check if intent_model.joblib exists
   → If yes: Load saved model
   → If no: Train new model

2. If training needed:
   a. Load training data from SQLite database
   b. If database empty:
      - Auto-generate 500 synthetic samples
      - Load generated data
   c. Train LogisticRegression on data
   d. Save model to intent_model.joblib

3. Model ready for predictions
```

**Prediction Method:**
```python
predict(session_minutes, latent_mean) → int:
  1. Prepare input: [[session_minutes, latent_mean]]
  2. Call model.predict()
  3. Return 0 or 1
```

**Model Performance:**
- **Overall Accuracy:** ~75.6%
- **Genuine Exits:** 86.93% accuracy (excellent)
- **Impulsive Exits:** 57.73% accuracy (moderate)
- **Training Data:** 500 research-backed samples

---

#### C. Database Layer (`data/database.py`)

**Purpose:** SQLite database operations for data persistence

**Database File:** `intentlock.db`

**Tables:**

**1. `synthetic_training_data`**
```sql
- id: INTEGER (Primary Key)
- session_minutes: REAL
- latent_mean: REAL
- label: INTEGER (1=impulsive, 0=genuine)
```
**Purpose:** Stores ML training data

**2. `exit_events`**
```sql
- id: INTEGER (Primary Key)
- timestamp: TEXT (ISO format)
- session_minutes: REAL
- latent_mean: REAL
- prediction: TEXT ("impulsive" | "genuine")
- friction_level: INTEGER (0, 1, or 2)
- allowed_exit: BOOLEAN
- session_id: TEXT
```
**Purpose:** Logs every exit attempt for analysis

**3. `exit_reasons`**
```sql
- id: INTEGER (Primary Key)
- exit_event_id: INTEGER (Foreign Key → exit_events)
- reason: TEXT (fatigue, distraction, boredom, etc.)
- custom_text: TEXT (optional)
```
**Purpose:** Stores user-provided reasons for exits

**Key Functions:**
- `init_database()` - Creates tables if they don't exist
- `insert_training_data()` - Adds training samples
- `get_training_data()` - Retrieves all training data
- `insert_exit_event()` - Logs exit attempts
- `count_impulsive_exits()` - Counts previous impulsive exits (for friction escalation)
- `insert_exit_reason()` - Stores exit reasons

---

#### D. Synthetic Data Generator (`data/synthetic_data_generator.py`)

**Purpose:** Generates research-backed training data

**Research Foundations:**
1. **Cognitive Load Theory (Sweller, 1988):** High cognitive load → task abandonment
2. **Attention Span Research:** Optimal focus is 20-30 minutes
3. **Pomodoro Technique:** Optimal sessions are 25-50 minutes

**Label Assignment Rules:**

**Rule 1: High Cognitive Load (>0.7) → Impulsive**
```
- Long session (>45 min) + High load → Impulsive (overwhelmed)
- Short session (<25 min) + High load → Impulsive (quickly overwhelmed)
- Medium session + High load → 80% Impulsive
```

**Rule 2: Low Cognitive Load (<0.3) → Genuine**
```
- Short session (<25 min) + Low load → Genuine (task completed)
- Long session (>45 min) + Low load → Genuine (productive session)
- Medium session + Low load → 85% Genuine
```

**Rule 3: Medium Load (0.3-0.7) → Probabilistic**
```
- Probability increases with:
  * Higher cognitive load
  * Longer session duration (fatigue)
- Base: 30% impulsive, adjusted by factors
```

**Data Generation:**
- **Session Duration:** Bimodal distribution
  - 40% short (5-30 min)
  - 40% medium (30-60 min)
  - 20% long (60-120 min)
- **Cognitive Load:** Beta(2, 3) distribution (mean ~0.4)
- **Default:** 500 samples (minimum 100 recommended)

---

## 🔄 Complete Data Flow

### Scenario 1: First Impulsive Exit Attempt

```
1. User clicks "Exit Study Session"
   ↓
2. Frontend: POST /predict-exit
   Body: {session_minutes: 45, latent_mean: 0.75, session_id: "session_123"}
   ↓
3. Backend: model.predict(45, 0.75) → Returns 1 (impulsive)
   ↓
4. Backend: count_impulsive_exits("session_123") → Returns 0
   ↓
5. Backend: friction_level = 0, requires_friction = True
   ↓
6. Backend: insert_exit_event() → Returns exit_event_id = 123
   ↓
7. Backend: Returns {prediction: "impulsive", friction_level: 0, ...}
   ↓
8. Frontend: Opens overlay with Level 0 (gentle reminder)
   ↓
9. User clicks "Exit Anyway"
   ↓
10. Frontend: Closes overlay, exits session
```

### Scenario 2: Second Impulsive Exit (Friction Escalation)

```
1. User clicks "Exit Study Session" again
   ↓
2. Frontend: POST /predict-exit (same flow)
   ↓
3. Backend: model.predict() → Returns 1 (impulsive)
   ↓
4. Backend: count_impulsive_exits("session_123") → Returns 1
   ↓
5. Backend: friction_level = 1, requires_friction = True
   ↓
6. Backend: Logs exit event, returns response
   ↓
7. Frontend: Opens overlay with Level 1 (reason required)
   ↓
8. User selects "boredom" from dropdown
   ↓
9. User clicks "Save & Exit"
   ↓
10. Frontend: POST /log-reason
    Body: {exit_event_id: 124, reason: "boredom", custom_text: null}
    ↓
11. Backend: insert_exit_reason() → Saves to database
    ↓
12. Frontend: Closes overlay, exits session
```

### Scenario 3: Genuine Exit (No Friction)

```
1. User clicks "Exit Study Session"
   ↓
2. Frontend: POST /predict-exit
   Body: {session_minutes: 20, latent_mean: 0.2, ...}
   ↓
3. Backend: model.predict(20, 0.2) → Returns 0 (genuine)
   ↓
4. Backend: friction_level = 0, requires_friction = False
   ↓
5. Backend: Logs exit event, returns response
   ↓
6. Frontend: Checks requires_friction = false
   ↓
7. Frontend: Shows alert("Exit allowed..."), exits immediately
   ↓
8. NO OVERLAY SHOWN - Immediate exit
```

### Scenario 4: Third+ Impulsive Exit (Maximum Friction)

```
1. User clicks "Exit Study Session" (third time)
   ↓
2. Backend: count_impulsive_exits() → Returns 2
   ↓
3. Backend: friction_level = 2
   ↓
4. Frontend: Opens overlay with Level 2 (countdown)
   ↓
5. User clicks "Confirm Exit"
   ↓
6. Frontend: Starts 3-second countdown
   ↓
7. User can cancel during countdown OR let it complete
   ↓
8. After countdown: Auto-exits
```

---

## 🎯 Key Design Decisions

### 1. **Gradual Friction Instead of Hard Blocking**
- **Why:** Respects user agency while still providing intervention
- **How:** Escalates from reminder → reason required → countdown
- **Benefit:** Users can always exit, but with increasing friction for impulsive behavior

### 2. **Genuine Exits Have Zero Friction**
- **Why:** Productive exits should be rewarded, not penalized
- **How:** `requires_friction = False` flag bypasses overlay
- **Benefit:** Smooth experience for legitimate exits

### 3. **Session-Based Friction Escalation**
- **Why:** Repeated impulsive exits in same session indicate distraction
- **How:** Counts previous impulsive exits per `session_id`
- **Benefit:** Adaptive intervention based on user behavior

### 4. **Research-Backed Data Generation**
- **Why:** Need realistic training data without real user data
- **How:** Cognitive Load Theory + attention span research
- **Benefit:** Model trained on scientifically-grounded patterns

### 5. **Database Logging for Analysis**
- **Why:** Collect behavioral data for research and model improvement
- **How:** Every exit attempt and reason logged
- **Benefit:** Future retraining and pattern analysis

---

## 📊 Current System Status

### ✅ Implemented Features

1. **ML Model**
   - Logistic Regression trained on 500 samples
   - 75.6% overall accuracy
   - Auto-generates data if database empty

2. **Gradual Friction System**
   - Level 0: Gentle reminder
   - Level 1: Reason required
   - Level 2: 3-second countdown

3. **Database Integration**
   - SQLite with 3 tables
   - Exit event logging
   - Reason collection

4. **Frontend Overlay**
   - Full-screen modal
   - Three friction level UIs
   - Session tracking

5. **API Endpoints**
   - `/predict-exit` - Main prediction
   - `/log-reason` - Reason logging

### ⏳ Future Enhancements

1. **More Features**
   - Idle time tracking
   - Focus loss events
   - Mouse/keyboard activity

2. **Model Improvements**
   - More training data
   - Different algorithms (Random Forest, SVM)
   - Feature engineering

3. **Personalization**
   - Per-user models
   - Adaptive thresholds
   - Learning from user feedback

4. **Advanced Friction**
   - More friction mechanisms
   - Customizable levels
   - A/B testing

---

## 🔍 Technical Details

### Technology Stack

**Backend:**
- Python 3.x
- FastAPI (REST API framework)
- scikit-learn (ML)
- SQLite (Database)
- Pydantic (Data validation)

**Frontend:**
- Next.js 16.1.1
- React 19.2.3
- TypeScript
- Client-side rendering

### File Structure

```
intentlock-backend/
├── main.py                    # FastAPI server
├── models/
│   ├── model.py              # ML model class
│   └── intent_model.joblib   # Trained model (binary)
├── data/
│   ├── database.py           # SQLite operations
│   ├── synthetic_data_generator.py  # Training data generator
│   └── RESEARCH_BACKING.md   # Research documentation
├── utils/
│   └── feature_extractor.py  # (Empty - for future use)
├── intentlock.db             # SQLite database
└── requirements.txt          # Python dependencies

intentlock-frontend/
├── app/
│   ├── page.tsx             # Main UI component
│   └── layout.tsx            # Root layout
├── components/
│   └── IntentLockOverlay.tsx # Friction overlay component
└── package.json              # Node dependencies
```

---

## 🎓 Research Foundations

The system is built on established research:

1. **Cognitive Load Theory (Sweller, 1988)**
   - High cognitive load → Task abandonment
   - Used for label assignment in data generation

2. **Attention Span Research**
   - 20-30 minutes optimal focus
   - Used for session duration thresholds

3. **Pomodoro Technique**
   - 25-50 minute optimal sessions
   - Used for realistic session patterns

4. **Human-Centered Design**
   - Soft intervention vs hard blocking
   - Preserves user agency

---

## 🚀 How to Use

### Starting the System

**Backend:**
```bash
cd intentlock-backend
venv\Scripts\activate
uvicorn main:app --reload
```

**Frontend:**
```bash
cd intentlock-frontend
npm run dev
```

### Testing Different Scenarios

1. **Genuine Exit:** Low cognitive load (<0.3) + Short session (<25 min)
2. **Impulsive Exit:** High cognitive load (>0.7) + Any session length
3. **Friction Escalation:** Multiple impulsive exits in same session

---

**Last Updated:** Complete System Analysis v1.0

