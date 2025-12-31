from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bandit_model import predict_context, predict_all_percentages, update_model_with_new_data
from data_integration import DataIntegrator

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

@app.post("/update-data")
async def update_data():
    """Manually trigger data integration and model update."""
    try:
        # Update data integration
        integrator = DataIntegrator()
        integrator.update_dataset()
        
        # Reinitialize model with new data
        model_info = update_model_with_new_data()
        
        return {
            "status": "success",
            "message": "Data and model updated successfully",
            "model_samples": len(model_info.arms) if hasattr(model_info, 'arms') else "unknown"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/data-stats")
async def get_data_stats():
    """Get statistics about current data."""
    try:
        integrator = DataIntegrator()
        exporter_df = integrator.load_exporter_data()
        yuvidu_df = integrator.load_yuvidu_dataset()
        
        return {
            "exporter_records": len(exporter_df),
            "yuvidu_records": len(yuvidu_df),
            "exporter_columns": list(exporter_df.columns) if not exporter_df.empty else [],
            "yuvidu_columns": list(yuvidu_df.columns) if not yuvidu_df.empty else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

