from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bandit_model import predict_context, predict_all_percentages, predict_weekly_windows, predict_next_best_4hour_window, get_hourly_intensity, generate_weekly_insights, predict_weekly_windows_ml

app = FastAPI()

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

@app.get("/weekly-predictionss")
async def get_weekly_predictions():
    try:
        weekly_data = predict_weekly_windows()
        return {
            "weekly_predictions": weekly_data,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/weekly-predictions")
async def get_weekly_predictions_ml():
    try:
        print("Fetching weekly predictions...")
        weekly_data = predict_weekly_windows_ml()  # or ML-based function
        print("Weekly data:", weekly_data)
        return {
            "weekly_predictions": weekly_data,
            "status": "success"
        }
    except Exception as e:
        print("Error in weekly predictions:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hourly-intensity")
async def get_hourly_intensity_endpoint():
    """
    Returns hourly intensity data based on historical session patterns.
    Analyzes the dataset to calculate study session frequency by hour.
    """
    try:
        result = get_hourly_intensity()
        return result
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

@app.get("/insights")
async def get_insights():
    try:
        result = generate_weekly_insights()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

