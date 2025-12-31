# Yuvidu Data Integration

This directory contains the integration between the `cog_py_est` exporter data and the Yuvidu bandit model.

## Overview

The integration system automatically converts real-time cognitive load data from the `cog_py_est` exporter into the format expected by the Yuvidu contextual bandit model, enabling personalized time-of-day recommendations.

## Components

### 1. `data_integration.py`
Handles the conversion of exporter data to Yuvidu format:

**Features:**
- Extracts time-based features from timestamps
- Converts block focus strings to numeric values
- Calculates rewards based on performance metrics
- Maps EMA ratings to normalized scores
- Simulates sleep hours based on time of day

**Data Mapping:**
| Exporter Field | Yuvidu Field | Transformation |
|---------------|--------------|----------------|
| `window_end` | `action` | Time of day (morning/afternoon/evening/night) |
| `window_end` | `sleep_hours_prev_night` | Estimated based on time |
| `block_focus` | `block_focus` | String → numeric hash |
| `keystroke_intervals_mean` | `keystroke_intervals_mean` | Direct mapping |
| `burstiness` | `burstiness` | Direct mapping |
| `scroll_rate` | `scroll_rate` | Direct mapping |
| `idle_time_percent` | `idle_time_percent` | Direct mapping |
| `microEMA_rating` | `microEMA` | 1-7 scale → 0-1 normalized |

### 2. `update_model.py`
Manages model retraining with new data:

**Features:**
- Automatically integrates new data before training
- Retrains the LinUCB bandit model
- Saves model statistics
- Provides model performance metrics

### 3. Updated `bandit_model.py`
Enhanced to support dynamic data:

**New Features:**
- Automatic data integration on initialization
- Fallback to static data if integration fails
- Manual model update capability
- Error handling for missing data

### 4. Enhanced `server.py`
Added new API endpoints:

**New Endpoints:**
- `POST /update-data` - Manually trigger data integration and model update
- `GET /data-stats` - Get current data statistics

## Usage

### Automatic Integration
The system automatically integrates new data when:
1. The bandit model is initialized
2. The `/update-data` endpoint is called

### Manual Integration
```python
from data_integration import DataIntegrator
from update_model import ModelUpdater

# Integrate data only
integrator = DataIntegrator()
integrator.update_dataset()

# Integrate data and retrain model
updater = ModelUpdater()
updater.update_and_save_model()
```

### API Usage
```bash
# Update data and model
curl -X POST http://localhost:5001/update-data

# Get data statistics
curl http://localhost:5001/data-stats

# Get predictions
curl http://localhost:5001/predictall
```

## Data Flow

1. **cog_py_est** collects cognitive load data → `yuvindu_data.db`
2. **DataIntegrator** reads SQLite → converts to CSV format
3. **ModelUpdater** retrains bandit model with new data
4. **API** serves updated predictions to frontend

## Reward Calculation

The reward function combines multiple performance metrics:

```python
reward = (
    keystroke_score * 0.3 +      # Typing speed
    burstiness_score * 0.2 +     # Typing consistency
    scroll_score * 0.15 +         # Mouse movement
    idle_score * 0.2 +           # Active time
    ema_score * 0.15             # Self-reported assessment
) * time_preference_bonus
```

## Time Features

- **Morning (6-12)**: Higher preference, ~7 hours sleep
- **Afternoon (12-18)**: Medium preference, ~6.5 hours sleep  
- **Evening (18-22)**: Lower preference, ~6 hours sleep
- **Night (22-6)**: Lowest preference, ~5 hours sleep

## File Structure

```
backend/
├── data_integration.py      # Data conversion logic
├── update_model.py         # Model retraining
├── bandit_model.py        # Enhanced bandit model
├── server.py              # API with new endpoints
├── large_contextual_bandit_dataset.csv  # Integrated dataset
├── yuvindu_data.db       # Exporter data (from cog_py_est)
└── INTEGRATION_README.md  # This file
```

## Troubleshooting

### Common Issues

1. **"Dataset not found"** - Run `data_integration.py` first to create the initial dataset
2. **"Model initialization failed"** - Check that `yuvindu_data.db` exists and has data
3. **Import errors** - Ensure all dependencies are installed: `pandas`, `numpy`, `mabwiser`

### Debug Commands

```python
# Check data integration
from data_integration import DataIntegrator
integrator = DataIntegrator()
print("Exporter records:", len(integrator.load_exporter_data()))
print("Yuvidu records:", len(integrator.load_yuvidu_dataset()))

# Test model update
from bandit_model import update_model_with_new_data
model = update_model_with_new_data()
print("Model updated successfully")
```

## Future Enhancements

1. **Real sleep data** - Integrate with actual sleep tracking
2. **Advanced reward function** - More sophisticated performance metrics
3. **Feature engineering** - Additional context features
4. **Model versioning** - Track model performance over time
5. **Automated scheduling** - Periodic model updates
