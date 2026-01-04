# Intent-Lock Overlay – Progress Summary

  
**Project:** Intelligent Study Assistant System  
**Component:** Intent-Lock Overlay for Distraction Prevention  
**Student:** Andrew Prathik (IT22087874)

---

## Completed Components

### 1. Intent Detection Model (ML Core)

**Type:** Binary classification (Impulsive vs Genuine exit)

- ✅ Logistic Regression baseline model implemented
- ✅ Synthetic training dataset defined
- ✅ Model persistence using joblib

#### Input Features

- Session duration (minutes)
- Typing speed (characters per minute)

#### Label Mapping

| Value | Classification |
| ----- | -------------- |
| `1`   | Impulsive Exit |
| `0`   | Genuine Exit   |

**Location:** `intentlock-backend/models/model.py`

---

### 2. Backend API (FastAPI)

**Infrastructure:**

- ✅ Python virtual environment configured
- ✅ FastAPI backend initialized
- ✅ Uvicorn dev server running
- ✅ CORS enabled for frontend integration

#### API Endpoints

**POST `/predict-exit`**

- **Input:** `session_minutes`, `typing_speed`
- **Output:** Exit intent classification

**POST `/log-exit`**

- **Input:** Exit type and user-provided reason
- **Output:** Logged exit data

**Location:** `intentlock-backend/main.py`

---

### 3. Intent-Lock Decision Logic

- ✅ Real-time exit evaluation
- ✅ Soft intervention logic
- ✅ Reflective confirmation for impulsive exits
- ✅ No hard blocking (user-centered approach)

---

### 4. Frontend Integration (Next.js)

**Features:**

- ✅ Exit button triggers intent prediction
- ✅ Backend API called via fetch
- ✅ Prediction displayed to user
- ✅ Loading and error states handled

**Location:** `intentlock-frontend/app/page.tsx`

---

### 5. Exit Reason Logging

- ✅ User provides exit reason
- ✅ Reasons logged with exit type
- ✅ Supports future retraining

---

### 6. End-to-End Pipeline

- ✅ Frontend-backend integration verified
- ✅ ML inference triggered by UI action
- ✅ Demo-ready system

---

## Pending Components

- ⏳ Additional behavioral features (idle time, focus loss)
- ⏳ Adaptive retraining loop
- ⏳ Multi-level intervention strategies
- ⏳ Formal evaluation metrics

---

## Key Achievements

- 🎯 **Intent-aware exit detection** – ML model successfully classifies user intent
- 🤝 **Human-centered design** – Non-intrusive intervention approach
- 🔗 **Working demo** – Complete ML + API + frontend integration
- 🔒 **Privacy-preserving** – Local processing, minimal data collection

---

## Next Steps

### Immediate

- Feature expansion
- Improve overlay UX
- Confidence-aware intervention logic

### Short-term

- Structured exit logging
- Adaptive thresholds
- User simulation tests

### Long-term

- Personalized intent models
- Evaluation study
- Research paper contribution

---

## Status

✅ **Core functionality implemented.**  
✅ **Component is demo-ready and suitable for supervisor evaluation.**
