import pandas as pd
import numpy as np
from mabwiser.mab import MAB, LearningPolicy
from data_integration import DataIntegrator
import pickle
from pathlib import Path

# Global variables for the model
mab = None
avg_context = None
arm_mapping = {'morning': 0, 'afternoon': 1, 'evening': 2, 'night': 3}
inverse_mapping = {v: k for k, v in arm_mapping.items()}

def initialize_model():
    """Initialize or reinitialize the bandit model with current data."""
    global mab, avg_context
    
    # Ensure data is up to date
    integrator = DataIntegrator()
    integrator.update_dataset()
    
    # Load dataset
    dataset_path = "large_contextual_bandit_dataset.csv"
    if not Path(dataset_path).exists():
        raise FileNotFoundError(f"Dataset {dataset_path} not found. Run data_integration.py first.")
    
    df = pd.read_csv(dataset_path)
    
    # Features used for context
    context_features = [
        'block_focus',
        'keystroke_intervals_mean',
        'burstiness',
        'scroll_rate',
        'idle_time_percent',
        'microEMA',
        'sleep_hours_prev_night'
    ]
    
    # Extract data
    actions_encoded = df['action'].map(arm_mapping).astype(int)
    rewards_array = df['reward'].astype(float).values
    context_df = df[context_features].astype(float)
    
    # Train model
    mab = MAB(
        arms=[0, 1, 2, 3],
        learning_policy=LearningPolicy.LinUCB(alpha=1.25)
    )
    
    mab.partial_fit(actions_encoded, rewards_array, context_df.values)
    
    # Compute average context for predictions
    avg_context = context_df.mean().values.reshape(1, -1)
    
    print(f"Bandit model initialized with {len(df)} samples.")
    return mab

# Initialize model on import
try:
    initialize_model()
except Exception as e:
    print(f"Warning: Could not initialize model: {e}")
    print("Using fallback static data...")
    
    # Fallback to original static data
    df2 = pd.read_csv(r"D:\Research-project\yuvidu\backend\large_contextual_bandit_dataset2.csv")
    context_features = [
        'block_focus',
        'keystroke_intervals_mean',
        'burstiness',
        'scroll_rate',
        'idle_time_percent',
        'microEMA',
        'sleep_hours_prev_night'
    ]
    
    actions_encoded = df2['action'].map(arm_mapping).astype(int)
    rewards_array = df2['reward'].astype(float).values
    context_df = df2[context_features].astype(float)
    
    mab = MAB(
        arms=[0, 1, 2, 3],
        learning_policy=LearningPolicy.LinUCB(alpha=1.25)
    )
    
    mab.partial_fit(actions_encoded, rewards_array, context_df.values)
    avg_context = context_df.mean().values.reshape(1, -1)
    print("Fallback model initialized with static data.")

def predict_context():
    """Returns the best predicted time of day as a string."""
    if mab is None or avg_context is None:
        initialize_model()
    
    best_arm = mab.predict(avg_context)
    result = inverse_mapping[int(best_arm)]
    print("Predicted time of day:", result)
    return result

def predict_all_percentages():
    """
    Returns predicted percentages for morning/afternoon/evening/night.
    """
    if mab is None or avg_context is None:
        initialize_model()
    
    context = avg_context
    scores = {}
    
    # Get predictions for all arms
    expectations = mab.predict_expectations(context)
    for arm in mab.arms:
        scores[arm] = float(expectations[arm])
    
    # Calculate percentages
    total = sum(scores.values())
    if total > 0:
        percentages = {inverse_mapping[a]: (scores[a] / total) * 100 for a in scores}
    else:
        # If all scores are zero, distribute equally
        percentages = {inverse_mapping[a]: 100.0 / len(scores) for a in scores}
    
    best_arm = max(scores, key=scores.get)
    return inverse_mapping[best_arm], percentages

def update_model_with_new_data():
    """Force update the model with new data from exporter."""
    return initialize_model()

# Add this at the end of the file
if __name__ == "__main__":
    print("Testing prediction:")
    best_time, percentages = predict_all_percentages()
    print(f"Best time: {best_time}")
    print("Percentages:")
    for time, percentage in percentages.items():
        print(f"  {time.capitalize()}: {percentage:.2f}%")