# Intent-Lock Overlay – Step-by-Step Implementation Guide

> **Purpose:** This document provides a clear, ordered, step-by-step guide to implement the Intent-Lock Overlay with Gradual Friction, Machine Learning prediction, synthetic data, database support, and an overlay-based UI.

## Tech Stack

- **Backend:** Python + FastAPI
- **Frontend:** Next.js (React + TypeScript)
- **Database:** SQLite
- **ML Model:** Logistic Regression (baseline)

---

## Phase 0: Goal Clarification

### System Purpose

The Intent-Lock Overlay system is designed to:

1. **Detect impulsive exits** during study sessions using ML
2. **Apply gradual, adaptive friction** instead of hard blocking
3. **Collect user reasons** for distraction/exit
4. **Operate as an overlay (modal)**, not a normal page

### Key Inputs

- `session_minutes` - Duration of current study session
- `latent_mean` - Cognitive load score from another module (0-1 scale)

---

## Phase 1: Backend Foundation

### Step 1: Confirm Backend Structure

Ensure the following directory structure exists:

```
intentlock-backend/
├── main.py
├── models/
│   └── model.py
├── data/
│   ├── synthetic_data_generator.py
│   └── database.py
├── utils/
│   └── feature_extractor.py
├── venv/
└── requirements.txt
```

**Action:** Create the `data/` folder if it's missing.

---

## Phase 2: Database Setup (Required)

### Step 2: Create SQLite Database

**File:** `data/database.py`

**Purpose:**

- Store persistent synthetic training data
- Log all exit attempts
- Store user-provided reasons for analysis

**Why SQLite:**

- Simple, file-based database
- No server setup required
- Perfect for research/prototyping
- Easy to inspect and query

### Step 3: Define Database Schema

Create three tables:

#### Table 1: `synthetic_training_data`

| Column            | Type    | Description                  |
| ----------------- | ------- | ---------------------------- |
| `id`              | INTEGER | Primary key (auto-increment) |
| `session_minutes` | FLOAT   | Session duration in minutes  |
| `latent_mean`     | FLOAT   | Cognitive load score (0-1)   |
| `label`           | INTEGER | 1 = impulsive, 0 = genuine   |

#### Table 2: `exit_events`

| Column            | Type    | Description                      |
| ----------------- | ------- | -------------------------------- |
| `id`              | INTEGER | Primary key (auto-increment)     |
| `timestamp`       | TEXT    | ISO format datetime              |
| `session_minutes` | FLOAT   | Session duration at exit attempt |
| `latent_mean`     | FLOAT   | Cognitive load at exit attempt   |
| `prediction`      | TEXT    | "impulsive" or "genuine"         |
| `friction_level`  | INTEGER | 0, 1, or 2                       |
| `allowed_exit`    | BOOLEAN | Whether user was allowed to exit |

#### Table 3: `exit_reasons`

| Column          | Type    | Description                  |
| --------------- | ------- | ---------------------------- |
| `id`            | INTEGER | Primary key (auto-increment) |
| `exit_event_id` | INTEGER | Foreign key to exit_events   |
| `reason`        | TEXT    | Predefined reason category   |
| `custom_text`   | TEXT    | Optional user-provided text  |

**Common reason categories:**

- `fatigue`
- `distraction`
- `boredom`
- `task_completed`
- `other`

---

## Phase 3: Synthetic Data Generation

### Step 4: Create Synthetic Data Generator

**File:** `data/synthetic_data_generator.py`

#### Responsibilities

1. Generate 500–2000 training samples
2. Create realistic feature distributions:
   - `session_minutes`: Uniform distribution (5–120 minutes)
   - `latent_mean`: Beta distribution (0–1, skewed toward realistic values)
3. Apply Cognitive Load Theory for labeling

#### Label Logic (Based on Cognitive Load Theory)

```
High cognitive load (latent_mean > 0.7) + Long session (>60 min) → Impulsive (1)
Low cognitive load (latent_mean < 0.3) + Short session (<20 min) → Genuine (0)
Middle cases → Probabilistic assignment based on combination
```

**Implementation Notes:**

- Use `numpy.random` for distributions
- Store all generated data in `synthetic_training_data` table
- Ensure balanced dataset (roughly 50/50 split)

### Step 5: Run Data Generator

**Commands:**

```bash
# Activate virtual environment
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

# Run generator
python data/synthetic_data_generator.py
```

**Verification:**

- ✅ `intentlock.db` file created in project root
- ✅ Data present in `synthetic_training_data` table
- ✅ Check row count: `SELECT COUNT(*) FROM synthetic_training_data;`

---

## Phase 4: Machine Learning Model

### Step 6: Update ML Model

**File:** `models/model.py`

**Requirements:**

1. **Load training data from SQLite**

   - Query `synthetic_training_data` table
   - Extract `session_minutes`, `latent_mean`, `label`

2. **Train Logistic Regression**

   - Use scikit-learn's `LogisticRegression`
   - Fit on loaded data

3. **Model Persistence**

   - Save trained model as `intent_model.joblib`
   - Reload saved model on subsequent runs (avoid retraining)

4. **Prediction Method**
   ```python
   def predict(self, session_minutes: float, latent_mean: float) -> int:
       # Returns 0 (genuine) or 1 (impulsive)
   ```

**Keep it simple and interpretable** - Logistic Regression is perfect for this baseline.

### Step 7: Verify Model Predictions

**Test Cases:**

```python
# High load + long session → should predict impulsive (1)
model.predict(session_minutes=45, latent_mean=0.75)
# Expected: 1

# Low load + short session → should predict genuine (0)
model.predict(session_minutes=10, latent_mean=0.2)
# Expected: 0
```

---

## Phase 5: FastAPI – Intent & Friction Logic

### Step 8: Update `/predict-exit` Endpoint

**Current:** `POST /predict-exit`

**Enhanced Response Format:**

```json
{
  "prediction": "impulsive" | "genuine",
  "friction_level": 0 | 1 | 2,
  "message": "Custom message based on friction level",
  "confidence": 0.0-1.0  // Optional: prediction confidence
}
```

**Input:**

```json
{
  "session_minutes": 45.0,
  "latent_mean": 0.75
}
```

### Step 9: Implement Gradual Friction Logic

**Rule-Based Escalation System:**

| Attempt Count  | Friction Level | Intervention Type            |
| -------------- | -------------- | ---------------------------- |
| 1st impulsive  | 0              | Gentle reminder              |
| 2nd impulsive  | 1              | Reason prompt required       |
| 3rd+ impulsive | 2              | Strong confirmation required |

**Implementation Details:**

1. **Track user attempts** (use session ID or user identifier)
2. **Query `exit_events` table** to count previous impulsive exits
3. **Determine friction level** based on count
4. **Log every attempt** in `exit_events` table (regardless of outcome)

**Friction Level Details:**

- **Level 0:** Simple message, two buttons (Continue / Exit)
- **Level 1:** Must select reason before exit allowed
- **Level 2:** Strong friction mechanism (see Step 12)

### Step 10: Add Reason Logging Endpoint

**New Endpoint:** `POST /log-reason`

**Request Body:**

```json
{
  "exit_event_id": 123,
  "reason": "boredom",
  "custom_text": "Optional additional context"
}
```

**Action:** Store in `exit_reasons` table with foreign key to `exit_events`.

---

## Phase 6: Frontend – Overlay UI

### Step 11: Create Overlay Component

**File:** `components/IntentLockOverlay.tsx`

**Overlay Requirements:**

- ✅ Full-screen modal overlay
- ✅ Semi-transparent dark background (blocks interaction)
- ✅ Centered content card
- ✅ Appears only when exit attempt is detected
- ✅ Cannot be dismissed by clicking outside (must complete flow)

**Styling:**

```css
position: fixed;
top: 0;
left: 0;
width: 100vw;
height: 100vh;
background: rgba(0, 0, 0, 0.7);
z-index: 9999;
```

### Step 12: Overlay States (Friction Levels)

#### Friction Level 0: Gentle Reminder

**UI Elements:**

- Message: "You've been focused. Are you sure you want to exit?"
- Buttons:
  - "Continue Studying" (closes overlay, continues session)
  - "Exit Anyway" (allows exit)

#### Friction Level 1: Reason Prompt

**UI Elements:**

- Message: "Before exiting, please tell us why:"
- Dropdown/Radio buttons with reason options:
  - Fatigue
  - Distraction
  - Boredom
  - Task Completed
  - Other (with text input)
- Buttons:
  - "Save & Exit" (logs reason, allows exit)
  - "Cancel" (closes overlay, continues session)

#### Friction Level 2: Strong Confirmation

**Choose ONE of the following mechanisms:**

**Option A: 3-Second Delay**

- Show countdown: "Exiting in 3... 2... 1..."
- Cancel button available during countdown
- Auto-exit after countdown

**Option B: Long-Press Button**

- User must hold "Exit" button for 2 seconds
- Visual feedback during hold (progress bar)
- Release cancels exit

**Option C: Type "EXIT"**

- Text input field
- User must type "EXIT" exactly
- Case-sensitive or case-insensitive (your choice)

### Step 13: Frontend-Backend Integration Flow

**Complete User Flow:**

```
1. User attempts to exit study session
   ↓
2. Frontend calls POST /predict-exit
   Body: { session_minutes, latent_mean }
   ↓
3. Backend responds with:
   { prediction, friction_level, message }
   ↓
4. Frontend renders IntentLockOverlay
   - Shows appropriate friction level UI
   - Blocks all background interaction
   ↓
5. User interacts with overlay:
   - If friction_level 1: Select reason
   - If friction_level 2: Complete confirmation
   ↓
6. Frontend calls POST /log-reason (if applicable)
   ↓
7. Overlay closes, user exits or continues
```

**State Management:**

- Use React hooks (`useState`, `useEffect`)
- Track overlay visibility
- Store friction level and prediction
- Handle async API calls

---

## Phase 7: Demo Completion Checklist

Before considering the component complete, verify:

- [ ] Backend successfully predicts impulsive vs genuine exits
- [ ] Friction level escalates correctly (0 → 1 → 2)
- [ ] User reasons are stored in database
- [ ] Overlay properly blocks UI interaction
- [ ] At least one complete demo flow works end-to-end
- [ ] Database persists data between sessions
- [ ] Model loads and predicts correctly

**Completion Status:** This equals ~45–50% of full component completion.

---

## Phase 8: Supervisor Explanation

**Key Talking Points:**

> "The Intent-Lock system introduces **adaptive friction** instead of hard blocking. Unlike traditional focus apps that completely prevent exit, this system:
>
> 1. **Detects intent** using machine learning based on session patterns and cognitive load
> 2. **Escalates intervention** gradually - first a gentle reminder, then requiring a reason, then stronger confirmation
> 3. **Preserves user agency** - users can always exit, but with increasing friction for impulsive behavior
> 4. **Collects behavioral data** - logged reasons form a dataset to analyze why focus breaks occur
>
> This approach respects user autonomy while still providing intervention to reduce impulsive distractions."

---

## Additional Notes

### Current Implementation Status

**✅ Completed:**

- Basic ML model (Logistic Regression)
- FastAPI backend with CORS
- Frontend Next.js app
- Basic prediction endpoint

**⏳ To Implement:**

- SQLite database integration
- Synthetic data generation
- Gradual friction logic
- Overlay component
- Reason logging system
- Friction level escalation

### Next Steps After Demo

1. Expand feature set (idle time, focus loss events)
2. Implement adaptive retraining loop
3. Add confidence thresholds
4. User personalization
5. Formal evaluation study

---

**Last Updated:** Implementation Guide v1.0
