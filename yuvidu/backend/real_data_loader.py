
# Load bandit training data from the Scheduler API (real sessions/rewards).
# Falls back to CSV only when the API is unavailable or returns no data.

import os
from typing import Optional

import pandas as pd
import requests

SCHEDULER_API_BASE = os.environ.get("SCHEDULER_API_BASE", "http://127.0.0.1:5000")
BANDIT_TRAINING_LIMIT = int(os.environ.get("YUVIDU_BANDIT_TRAINING_LIMIT", "500"))


def fetch_bandit_training_data(user_id: Optional[str] = None) -> Optional[pd.DataFrame]:
    
    # Fetch bandit training rows from Scheduler API.
    # Returns DataFrame with same columns as synthetic CSV, or None on failure/empty.
    
    try:
        url = f"{SCHEDULER_API_BASE.rstrip('/')}/api/bandit/training-data"
        params = {"limit": BANDIT_TRAINING_LIMIT}
        if user_id:
            params["user_id"] = user_id
        r = requests.get(url, params=params, timeout=10)
        if not r.ok:
            return None
        data = r.json()
        rows = data.get("rows") or []
        if not rows:
            return None
        return pd.DataFrame(rows)
    except Exception:
        return None


def load_bandit_data(user_id: Optional[str] = None, csv_fallback_path: str = "synthetic_student_sessions.csv") -> pd.DataFrame:
    
    # Load bandit training data: prefer Scheduler API (real data), fall back to CSV.
    
    df = fetch_bandit_training_data(user_id=user_id)
    if df is not None and len(df) > 0:
        # Ensure required columns and types for bandit_model
        required = [
            "date", "starttime", "endtime", "session_id",
            "block_focus", "keystroke_intervals_mean", "burstiness", "scroll_rate",
            "idle_time_percent", "microEMA", "sleep_hours_prev_night",
            "action", "reward",
        ]
        for col in required:
            if col not in df.columns:
                return _load_csv_fallback(csv_fallback_path)
        # Normalize action to allowed values
        allowed = {"morning", "afternoon", "evening", "night"}
        if not df["action"].dropna().isin(allowed).all():
            df["action"] = df["action"].replace(to_replace=[x for x in df["action"].unique() if x not in allowed], value="afternoon")
        print(f"Bandit model using real data from Scheduler: {len(df)} rows.")
        return df
    return _load_csv_fallback(csv_fallback_path)


def _load_csv_fallback(path: str) -> pd.DataFrame:
    # Load CSV when real data is not available.
    if os.path.isfile(path):
        print(f"Bandit model using fallback CSV: {path}")
        return pd.read_csv(path)
    raise FileNotFoundError(f"Neither Scheduler training data nor CSV found. Expected CSV at: {path}")
