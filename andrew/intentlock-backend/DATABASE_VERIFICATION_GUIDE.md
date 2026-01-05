# Database Verification Guide

This guide explains how to verify your database schema and ensure accurate predictions.

## 🔍 Inspection Tools

### 1. Comprehensive Inspection (`inspect_database.py`)

**Full database analysis with detailed reports:**

```bash
python inspect_database.py
```

**What it shows:**
- ✅ Database schema (all tables, columns, foreign keys)
- ✅ Training data analysis (distribution, statistics, samples)
- ✅ Exit events log (predictions, friction levels, recent events)
- ✅ Exit reasons analysis
- ✅ Data quality verification (nulls, ranges, integrity)
- ✅ Model accuracy on training data

**Output includes:**
- Schema structure verification
- Training data distribution (impulsive vs genuine)
- Feature statistics (session minutes, cognitive load ranges)
- Category analysis (high/medium/low cognitive load)
- Data quality checks
- Model accuracy metrics and confusion matrix

---

### 2. Quick Check (`quick_db_check.py`)

**Fast verification for common checks:**

```bash
# All checks
python quick_db_check.py

# Specific checks
python quick_db_check.py schema      # Show table structure
python quick_db_check.py training    # Training data summary
python quick_db_check.py events      # Recent exit events
python quick_db_check.py accuracy    # Model accuracy only
```

---

## 📊 What to Verify

### 1. **Schema Verification**

**Check:**
- ✅ All 3 tables exist: `synthetic_training_data`, `exit_events`, `exit_reasons`
- ✅ Column types are correct
- ✅ Foreign keys are properly set up

**Expected Schema:**

**Table: `synthetic_training_data`**
```
- id: INTEGER (Primary Key)
- session_minutes: REAL
- latent_mean: REAL
- label: INTEGER (0 or 1)
```

**Table: `exit_events`**
```
- id: INTEGER (Primary Key)
- timestamp: TEXT
- session_minutes: REAL
- latent_mean: REAL
- prediction: TEXT ("impulsive" or "genuine")
- friction_level: INTEGER (0, 1, or 2)
- allowed_exit: BOOLEAN
- session_id: TEXT
```

**Table: `exit_reasons`**
```
- id: INTEGER (Primary Key)
- exit_event_id: INTEGER (Foreign Key → exit_events.id)
- reason: TEXT
- custom_text: TEXT (nullable)
```

---

### 2. **Training Data Verification**

**Check:**
- ✅ At least 100 samples (recommended: 500+)
- ✅ Balanced distribution (30-70% for each class)
- ✅ Feature ranges are realistic:
  - `session_minutes`: 5-120 minutes
  - `latent_mean`: 0.0-1.0
- ✅ No NULL values
- ✅ Category patterns match research:
  - High load (>0.7) → Mostly impulsive
  - Low load (<0.3) → Mostly genuine

**Good Training Data:**
```
Total: 500+ samples
Distribution: ~40-60% impulsive, ~40-60% genuine
High Load (>0.7): 90%+ impulsive
Low Load (<0.3): 90%+ genuine
```

---

### 3. **Model Accuracy Verification**

**Check:**
- ✅ Overall accuracy ≥ 70%
- ✅ Genuine exit accuracy ≥ 80% (important for no-friction exits)
- ✅ Impulsive exit accuracy ≥ 50% (acceptable for baseline)

**Expected Metrics:**
```
Overall Accuracy:     75-80%
Genuine Accuracy:     85-90%  (Critical - these bypass friction)
Impulsive Accuracy:   55-65%  (Acceptable for baseline)
```

**If accuracy is low:**
1. Generate more training data: `python generate_training_data.py 1000`
2. Delete model: `rm models/intent_model.joblib`
3. Restart backend (model will retrain)

---

### 4. **Data Quality Checks**

**Verify:**
- ✅ No NULL values in required fields
- ✅ Feature ranges are valid
- ✅ Foreign key integrity (exit_reasons linked to exit_events)
- ✅ Timestamps are valid ISO format

**All checks should pass:**
```
✅ Training data: 500 samples
✅ No NULL values in training data
✅ Balanced dataset: 38.8% impulsive, 61.2% genuine
✅ Session range: 5.0 - 119.0 minutes
✅ Cognitive load range: 0.022 - 0.965
✅ Foreign key integrity: All exit_reasons linked to valid exit_events
```

---

### 5. **Exit Events Verification**

**Check:**
- ✅ Events are being logged correctly
- ✅ Predictions match expected patterns
- ✅ Friction levels escalate correctly (0 → 1 → 2)
- ✅ Genuine exits have `requires_friction = false`

**Expected Patterns:**
- First impulsive exit → Friction Level 0
- Second impulsive exit → Friction Level 1
- Third+ impulsive exit → Friction Level 2
- Genuine exits → Friction Level 0, `allowed_exit = true`

---

## 🔧 Common Issues & Fixes

### Issue: "No training data found"

**Fix:**
```bash
python data/synthetic_data_generator.py
# or
python generate_training_data.py
```

---

### Issue: "Model accuracy is low (<60%)"

**Fix:**
```bash
# Generate more data
python generate_training_data.py 1000

# Delete old model
rm models/intent_model.joblib  # Linux/Mac
del models\intent_model.joblib  # Windows

# Restart backend (will retrain)
```

---

### Issue: "Imbalanced dataset"

**Fix:**
- Check `synthetic_data_generator.py` label assignment logic
- Regenerate data: `python generate_training_data.py`

---

### Issue: "Invalid feature ranges"

**Fix:**
- Check data generator distributions
- Verify cognitive load is 0-1
- Verify session minutes are reasonable (5-120)

---

## 📈 Interpreting Results

### Good Database State:
```
✅ All tables exist with correct schema
✅ 500+ training samples
✅ Balanced distribution (40-60% each class)
✅ Model accuracy ≥ 70%
✅ Genuine accuracy ≥ 85%
✅ No data quality issues
```

### Needs Attention:
```
⚠️  Low training data (<100 samples)
⚠️  Imbalanced dataset (<30% or >70% one class)
⚠️  Model accuracy 60-70%
⚠️  Genuine accuracy <80%
```

### Critical Issues:
```
❌ No training data
❌ Model accuracy <60%
❌ Invalid feature ranges
❌ NULL values in required fields
❌ Foreign key integrity broken
```

---

## 🎯 Quick Verification Checklist

Run before important demos or evaluations:

- [ ] Run `python inspect_database.py` - all checks pass
- [ ] Training data: 500+ samples
- [ ] Model accuracy: ≥70%
- [ ] Genuine accuracy: ≥85%
- [ ] No data quality warnings
- [ ] Schema is correct
- [ ] Recent exit events look correct

---

## 📝 Example Output

**Good State:**
```
✅ Training data: 500 samples
✅ Balanced dataset: 38.8% impulsive, 61.2% genuine
✅ Model accuracy: 75.60%
✅ Genuine accuracy: 86.93%
✅ All data quality checks passed!
```

**Needs Improvement:**
```
⚠️  Low training data count (50) - recommend at least 100 samples
⚠️  Model accuracy is moderate (65%) - consider more training data
```

---

**Last Updated:** Database Verification Guide v1.0

