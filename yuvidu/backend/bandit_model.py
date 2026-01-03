import pandas as pd
import numpy as np
from mabwiser.mab import MAB, LearningPolicy
from datetime import datetime, timedelta

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


def predict_weekly_windows():
    """
    Returns predicted best study windows for each day of the week.
    Analyzes historical data to find optimal time windows for weekdays vs weekends.
    """
    # Extract day of week from date column
    df2['date'] = pd.to_datetime(df2['date'])
    df2['day_of_week'] = df2['date'].dt.day_name()
    
    # Group by day of week and calculate average rewards by time of day
    weekly_predictions = {}
    
    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        day_data = df2[df2['day_of_week'] == day]
        
        if len(day_data) == 0:
            # If no data for this day, use general prediction
            weekly_predictions[day] = {
                'best_time': predict_context(),
                'confidence': 0.5,
                'data_points': 0
            }
            continue
        
        # Calculate average reward by action for this day
        day_rewards = day_data.groupby('action')['reward'].mean()
        
        if len(day_rewards) > 0:
            best_action = day_rewards.idxmax()
            best_reward = day_rewards.max()
            total_reward = day_rewards.sum()
            confidence = best_reward / total_reward if total_reward > 0 else 0.5
            
            weekly_predictions[day] = {
                'best_time': best_action,
                'confidence': float(confidence),
                'data_points': len(day_data),
                'all_times': {action: float(reward) for action, reward in day_rewards.items()}
            }
        else:
            weekly_predictions[day] = {
                'best_time': predict_context(),
                'confidence': 0.5,
                'data_points': 0
            }
    
    return weekly_predictions

def predict_next_best_4hour_window():
    """
    Predicts the next best 4-hour study window for today using contextual bandit.
    Takes current date/time into account and analyzes historical performance.
    """
    now = datetime.now()
    current_hour = now.hour
    current_day = now.strftime("%A")
    
    # Define 4-hour windows starting from each hour (0-23)
    windows = []
    for start_hour in range(24):
        end_hour = (start_hour + 3) % 24  # 3 hours later to make 4-hour window
        windows.append({
            'start_hour': start_hour,
            'end_hour': end_hour,
            'time_range': f"{start_hour:02d}:00 - {(end_hour + 1) % 24:02d}:00"
        })
    
    # Calculate scores for each window using contextual bandit
    window_scores = {}
    
    for window in windows:
        start_hour = window['start_hour']
        
        # Determine which time period this window falls into
        if 6 <= start_hour < 12:
            time_period = 'morning'
        elif 12 <= start_hour < 18:
            time_period = 'afternoon'
        elif 18 <= start_hour < 22:
            time_period = 'evening'
        else:
            time_period = 'night'
        
        # Get contextual bandit prediction for this time period
        context = avg_context
        expectations = mab.predict_expectations(context)
        arm_score = expectations[arm_mapping[time_period]]
        
        # Apply time-based modifiers
        modifier = 1.0
        
        # Boost future windows slightly
        if start_hour > current_hour:
            hours_ahead = start_hour - current_hour
            if hours_ahead <= 8:  # Within next 8 hours
                modifier *= 1.2
            elif hours_ahead <= 16:  # Within next 16 hours
                modifier *= 1.1
        
        # Reduce score for past windows today
        elif start_hour < current_hour:
            modifier *= 0.3
        
        # Weekend vs weekday adjustment
        is_weekend = current_day in ['Saturday', 'Sunday']
        if is_weekend and time_period in ['morning', 'afternoon']:
            modifier *= 1.15  # Weekend mornings/afternoons are typically better
        elif not is_weekend and time_period == 'night':
            modifier *= 0.9  # Weekday nights might be less productive
        
        # Sleep hours consideration (if sleep_hours_prev_night is available in context)
        avg_sleep = avg_context[0][-1] if len(avg_context[0]) > 0 else 7  # Default 7 hours
        if avg_sleep < 6 and time_period == 'morning':
            modifier *= 0.8  # Less sleep = less productive mornings
        elif avg_sleep >= 8 and time_period == 'morning':
            modifier *= 1.1  # Good sleep = better mornings
        
        final_score = float(arm_score) * modifier
        window_scores[window['time_range']] = final_score
    
    # Sort windows by score
    sorted_windows = sorted(window_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Get the best window
    best_window_time, best_score = sorted_windows[0]
    
    # Calculate confidence based on score distribution
    all_scores = [score for _, score in sorted_windows]
    if all_scores:
        max_score = max(all_scores)
        second_best_score = all_scores[1] if len(all_scores) > 1 else 0
        confidence = (max_score - second_best_score) / max_score if max_score > 0 else 0.5
        confidence = min(max(confidence, 0.1), 0.95)  # Clamp between 0.1 and 0.95
    else:
        confidence = 0.5
    
    # Parse the best window time
    start_time_str, end_time_str = best_window_time.split(' - ')
    start_hour = int(start_time_str.split(':')[0])
    end_hour = int(end_time_str.split(':')[0])
    
    # Create datetime objects for today
    best_start = now.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    best_end = now.replace(hour=end_hour, minute=0, second=0, microsecond=0)
    
    # If end hour is earlier than start hour, it means it crosses midnight
    if end_hour < start_hour:
        best_end += timedelta(days=1)
    
    # If the best window has passed for today, suggest tomorrow's same window
    if best_end < now:
        best_start += timedelta(days=1)
        best_end += timedelta(days=1)
        day_label = "Tomorrow"
    else:
        day_label = "Today"
    
    return {
        'best_window': {
            'start_time': best_start.strftime(f"%Y-%m-%d {day_label} %I:%M %p").replace(" 12:", " 12:").replace(" 0", " 12"),
            'end_time': best_end.strftime(f"%Y-%m-%d {day_label} %I:%M %p").replace(" 12:", " 12:").replace(" 0", " 12"),
            'time_range': best_window_time,
            'duration_hours': 4
        },
        'confidence': round(confidence, 3),
        'score': round(best_score, 3),
        'alternatives': [
            {
                'time_range': time_range,
                'score': round(score, 3)
            } for time_range, score in sorted_windows[1:4]  # Top 3 alternatives
        ],
        'current_context': {
            'current_time': now.strftime("%Y-%m-%d %I:%M %p"),
            'current_day': current_day,
            'data_points': len(df2)
        }
    }

if __name__ == "__main__":
    print("Testing prediction:")
    best_time, percentages = predict_all_percentages()
    print(f"Best time: {best_time}")
    print("Percentages:")
    for time, percentage in percentages.items():
        print(f"  {time.capitalize()}: {percentage:.2f}%")
    
    print("\nTesting weekly predictions:")
    weekly = predict_weekly_windows()
    for day, data in weekly.items():
        print(f"{day}: {data['best_time']} (confidence: {data['confidence']:.2f}, sessions: {data['data_points']})")
    
    print("\nTesting next best 4-hour window prediction:")
    next_window = predict_next_best_4hour_window()
    print(f"Best window: {next_window['best_window']['time_range']}")
    print(f"Start: {next_window['best_window']['start_time']}")
    print(f"End: {next_window['best_window']['end_time']}")
    print(f"Confidence: {next_window['confidence']}")
    print(f"Score: {next_window['score']}")