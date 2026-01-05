from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from models.model import IntentModel
from fastapi.middleware.cors import CORSMiddleware
from data.database import (
    init_database,
    insert_exit_event,
    count_impulsive_exits,
    insert_exit_reason
)

app = FastAPI(title="Intent-Lock Backend", description="API for IntentLock")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
init_database()
model = IntentModel()

class PredictRequest(BaseModel):
    session_minutes: float
    latent_mean: float
    session_id: str = "default"  # Optional session identifier

class LogReasonRequest(BaseModel):
    exit_event_id: int
    reason: str
    custom_text: Optional[str] = None

@app.get("/")
def read_root():
    return {"message": "Intent-Lock Backend is running"}

@app.post("/predict-exit")
def predict_exit(data: PredictRequest):
    """
    Predict exit intent and determine friction level
    
    Returns:
    - prediction: "impulsive" or "genuine"
    - friction_level: 0, 1, or 2
    - message: Custom message based on friction level
    - exit_event_id: ID of logged exit event
    """
    try:
        # Get prediction from model
        prediction_value = model.predict(data.session_minutes, data.latent_mean)
        prediction_label = "impulsive" if prediction_value == 1 else "genuine"
        
        # Determine friction level based on previous impulsive exits
        if prediction_label == "impulsive":
            impulsive_count = count_impulsive_exits(data.session_id)
            
            if impulsive_count == 0:
                friction_level = 0
                message = "You've been focused. Are you sure you want to exit?"
            elif impulsive_count == 1:
                friction_level = 1
                message = "Before exiting, please tell us why:"
            else:  # 2 or more
                friction_level = 2
                message = "You've attempted to exit multiple times. Please confirm your intent."
            
            # Impulsive exits require friction
            requires_friction = True
        else:
            # Genuine exit - no friction, immediate exit allowed
            friction_level = 0
            message = "Exit allowed. You've had a productive session."
            requires_friction = False
        
        # Log exit event to database
        exit_event_id = insert_exit_event(
            session_minutes=data.session_minutes,
            latent_mean=data.latent_mean,
            prediction=prediction_label,
            friction_level=friction_level,
            allowed_exit=(prediction_label == "genuine" or friction_level == 0),
            session_id=data.session_id
        )
        
        return {
            "prediction": prediction_label,
            "friction_level": friction_level,
            "message": message,
            "exit_event_id": exit_event_id,
            "requires_friction": requires_friction  # Flag to indicate if overlay should be shown
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/log-reason")
def log_reason(data: LogReasonRequest):
    """
    Log user-provided reason for exit
    
    Required for friction_level 1 and 2
    """
    try:
        insert_exit_reason(
            exit_event_id=data.exit_event_id,
            reason=data.reason,
            custom_text=data.custom_text
        )
        return {"status": "saved", "message": "Reason logged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logging error: {str(e)}")