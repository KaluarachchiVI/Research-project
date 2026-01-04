from fastapi import FastAPI
from pydantic import BaseModel
from models.model import IntentModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title ="Intent-Lock Backend", description="API for IntentLock")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = IntentModel()

class PredictRequest(BaseModel):
    session_minutes: float
    typing_speed: float

class LogRequest(BaseModel):
    exit_type: str
    reason: str

@app.get("/")
def read_root():
    return {"message": "Intent-Lock Backend is running"}

@app.post("/predict-exit")
def predict_exit(data: PredictRequest):
    prediction = model.predict(data.session_minutes, data.typing_speed)
    label = "Impulsive" if prediction == 1 else "Genuine"
    return {"prediction": label}

@app.post("/log-exit")
def log_exit(data: LogRequest):
    with open("exit_logs.txt", "a") as f:
        f.write(f"{data.exit_type} - {data.reason}\n")
    return {"status": "saved"}