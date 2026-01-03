from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bandit_model import predict_context, predict_all_percentages, predict_weekly_windows, predict_next_best_4hour_window
import pandas as pd
from datetime import datetime
import numpy as np

app = FastAPI()

# Cache the dataset to avoid reloading on every request
try:
    df = pd.read_csv("large_contextual_bandit_dataset_with_night.csv")
    print(f"Dataset loaded successfully with {len(df)} rows")
except Exception as e:
    print(f"Error loading dataset: {e}")
    df = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Bandit API Running!"}

@app.get("/predict")
async def get_prediction():
    try:
        result = predict_context()
        return {"prediction": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/predictall")
async def getallpredicts():
    try:
        best_time, percentages = predict_all_percentages()
        return {
            "best_time": best_time,
            "percentages": percentages,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/weekly-predictions")
async def get_weekly_predictions():
    try:
        weekly_data = predict_weekly_windows()
        return {
            "weekly_predictions": weekly_data,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hourly-intensity")
async def get_hourly_intensity():
    try:
        if df is None:
            raise HTTPException(status_code=500, detail="Dataset not loaded")
        
        # Initialize hourly intensity (0-23 hours)
        hourly_intensity = {str(i).zfill(2): 0 for i in range(24)}
        
        # Count sessions by hour
        for _, row in df.iterrows():
            start_time = row['starttime']
            end_time = row['endtime']
            
            # Parse start and end hours
            start_hour = int(str(start_time).split(':')[0])
            end_hour = int(str(end_time).split(':')[0])
            
            # Add intensity for each hour in the session
            current_hour = start_hour
            while True:
                hourly_intensity[str(current_hour).zfill(2)] += 1
                
                if current_hour == end_hour:
                    break
                    
                current_hour = (current_hour + 1) % 24
                
                # Prevent infinite loops
                if current_hour == start_hour:
                    break
        
        # Convert to percentages
        total_sessions = len(df)
        hourly_percentages = {
            hour: (count / total_sessions) * 100 
            for hour, count in hourly_intensity.items()
        }
        
        # Format hours as 6AM, 7AM, etc.
        formatted_hours = []
        for i in range(24):
            hour_24 = str(i).zfill(2)
            hour_12 = f"{i % 12 or 12}{'AM' if i < 12 else 'PM'}"
            formatted_hours.append({
                "hour": hour_12,
                "intensity": hourly_percentages[hour_24]
            })
        
        return {
            "hourly_data": formatted_hours,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/next-best-study-window")
async def get_next_best_study_window():
    """
    Returns the next best 4-hour study window for today using contextual bandit algorithm.
    Takes current date/time into account and analyzes historical performance.
    """
    try:
        result = predict_next_best_4hour_window()
        return {
            "prediction": result,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

