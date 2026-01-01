import pandas as pd
import numpy as np
from mabwiser.mab import MAB, LearningPolicy

# Load dataset
df2 = pd.read_csv("large_contextual_bandit_dataset_with_night.csv")

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

# Action mapping
arm_mapping = {'morning': 0, 'afternoon': 1, 'evening': 2, 'night': 3}
inverse_mapping = {v: k for k, v in arm_mapping.items()}

# Extract data
actions_encoded = df2['action'].replace(arm_mapping).astype(int).to_numpy()
rewards_array = df2['reward'].astype(float).to_numpy()
context_df = df2[context_features].astype(float)

# Train model
mab = MAB(
    arms=[0, 1, 2, 3],
    learning_policy=LearningPolicy.LinUCB(alpha=1.25)
)

mab.partial_fit(actions_encoded, rewards_array, context_df.values.tolist())
print("Bandit model initialized and trained.")

# Compute average context and predict once
avg_context_mean = context_df.mean()
if isinstance(avg_context_mean, pd.Series):
    avg_context = avg_context_mean.to_numpy().reshape(1, -1)
else:
    avg_context = np.array([[avg_context_mean]])
prediction = mab.predict(avg_context)
best_arm = prediction[0] if isinstance(prediction, (list, np.ndarray)) else prediction

def predict_context():
    """Returns best predicted time of day as a string."""
    result = inverse_mapping[best_arm]
    print("Predicted time of day:", result)  # This will now print
    return result

def predict_all_percentages():
    """
    Returns predicted percentages for morning/afternoon/evening/night based on real data.
    """
    context = avg_context  # using your average context
    scores = {}
    
    # Get predictions for all arms
    expectations = mab.predict_expectations(context)
    for arm in mab.arms:
        # Get the score for this arm
        scores[arm] = float(expectations[arm])
    
    # Calculate percentages
    total = sum(scores.values())
    if total > 0:
        percentages = {inverse_mapping[a]: (scores[a] / total) * 100 for a in scores}
    else:
        # If all scores are zero, distribute equally
        percentages = {inverse_mapping[a]: 100.0 / len(scores) for a in scores}
    
    best_arm = max(scores.keys(), key=lambda arm: scores[arm])
    return inverse_mapping[best_arm], percentages


# Add this at the end of the file
if __name__ == "__main__":
    print("Testing prediction:")
    best_time, percentages = predict_all_percentages()
    print(f"Best time: {best_time}")
    print("Percentages:")
    for time, percentage in percentages.items():
        print(f"  {time.capitalize()}: {percentage:.2f}%")