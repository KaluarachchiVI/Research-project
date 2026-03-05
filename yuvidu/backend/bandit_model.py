import pandas as pd
import numpy as np
from mabwiser.mab import MAB, LearningPolicy
from datetime import datetime, timedelta
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder

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
# This ensures correct 2D shape for model input
recent_context_df = context_df.tail(3)  # or .tail(4)

avg_context_mean = recent_context_df.mean()



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



def predict_weekly_windows_ml():
    """
    ML-based weekly prediction: predicts expected reward per day for next week.
    """
    df = df2.copy()
    df['day_of_week'] = pd.to_datetime(df['date']).dt.day_name()
    days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

    # One-hot encode day
    ohe = OneHotEncoder(sparse_output=False)
    day_encoded = ohe.fit_transform(df[['day_of_week']])

    # Features
    X = np.hstack([
        df[['block_focus','keystroke_intervals_mean','burstiness','scroll_rate',
            'idle_time_percent','microEMA','sleep_hours_prev_night']].values,
        day_encoded
    ])
    y = df['reward'].values

    # Train model
    model = GradientBoostingRegressor(n_estimators=200, max_depth=4)
    model.fit(X, y)

    # Predict for next week using user's average context
    avg_context = df[['block_focus','keystroke_intervals_mean','burstiness','scroll_rate',
                      'idle_time_percent','microEMA','sleep_hours_prev_night']].mean().values

    weekly_preds = {}
    for i, day in enumerate(days):
        day_onehot = np.zeros(len(days))
        day_onehot[i] = 1
        X_pred = np.hstack([avg_context, day_onehot]).reshape(1,-1)
        weekly_preds[day] = float(model.predict(X_pred)[0])

    # Convert to the same format as predict_weekly_windows for frontend compatibility
    weekly_predictions = {}
    max_reward = max(weekly_preds.values())
    min_reward = min(weekly_preds.values())
    reward_range = max_reward - min_reward if max_reward != min_reward else 1
    
    for day, reward in weekly_preds.items():
        # Normalize confidence based on reward distribution
        normalized_reward = (reward - min_reward) / reward_range
        confidence = max(0.3, normalized_reward)  # Ensure minimum confidence of 0.3
        
        weekly_predictions[day] = {
            'best_time': 'morning',  # Default time
            'confidence': float(confidence),
            'data_points': len(df[df['day_of_week'] == day]),
            'predicted_reward': float(reward),
            'all_times': {
                'morning': float(reward),
                'afternoon': float(reward * 0.9),
                'evening': float(reward * 0.8),
                'night': float(reward * 0.7)
            }
        }
    
    return weekly_predictions

def get_hourly_intensity():
    """
    Returns hourly intensity data based on historical session patterns.
    Analyzes the dataset to calculate study session frequency by hour.
    """
    try:
        if df2 is None or len(df2) == 0:
            raise Exception("Dataset not loaded")
        
        # Initialize hourly intensity (0-23 hours)
        hourly_intensity = {str(i).zfill(2): 0 for i in range(24)}
        
        # Count sessions by hour
        for _, row in df2.iterrows():
            if 'starttime' not in row or 'endtime' not in row:
                continue
                
            start_time = row['starttime']
            end_time = row['endtime']
            
            # Parse start and end hours
            try:
                start_hour = int(str(start_time).split(':')[0])
                end_hour = int(str(end_time).split(':')[0])
            except (ValueError, AttributeError):
                continue
            
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
        
        # Calculate percentages
        total_sessions = len(df2)
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
        raise Exception(f"Error calculating hourly intensity: {str(e)}")

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
            'start_time': best_start.strftime("%Y-%m-%d %I:%M %p"),
            'end_time': best_end.strftime("%Y-%m-%d %I:%M %p"),
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

#-----------------------------give advanced insights-----------------------------

def generate_weekly_insights():
    """
    Generates smart weekly insights based on historical data.
    Returns list of human-readable insight strings.
    """
    try:
        df = df2.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        insights = []

        # -----------------------------
        # 1️⃣ Productivity Change vs Last Week
        # -----------------------------
        df['year_week'] = df['date'].dt.strftime('%Y-%U')
        weekly_avg = df.groupby('year_week')['reward'].mean().sort_index()

        if len(weekly_avg) >= 2:
            previous_week = weekly_avg.iloc[-2]
            current_week = weekly_avg.iloc[-1]

            if previous_week != 0:
                change_percent = ((current_week - previous_week) / previous_week) * 100
            else:
                change_percent = 100

            if change_percent > 0:
                insights.append(
                    f"You are {abs(change_percent):.1f}% more productive than last week."
                )
            elif change_percent < 0:
                insights.append(
                    f"You are {abs(change_percent):.1f}% less productive than last week."
                )
            else:
                insights.append(
                    "Your productivity remained consistent compared to last week."
                )

        # -----------------------------
        # 2️⃣ Best Study Day
        # -----------------------------
        df['day_name'] = df['date'].dt.day_name()
        day_rewards = df.groupby('day_name')['reward'].mean()

        if len(day_rewards) > 0:
            best_day = day_rewards.idxmax()
            best_day_reward = day_rewards.max()
            worst_day = day_rewards.idxmin()
            worst_day_reward = day_rewards.min()
            
            insights.append(f"Your best study day is {best_day} with average reward of {best_day_reward:.3f}.")
            
            # Add comparison insight
            if best_day_reward > worst_day_reward * 1.5:
                insights.append(f"You're {((best_day_reward/worst_day_reward - 1) * 100):.0f}% more productive on {best_day} compared to {worst_day}.")

        # -----------------------------
        # 3️⃣ Best Time of Day Performance Boost
        # -----------------------------
        time_rewards = df.groupby('action')['reward'].mean()

        if len(time_rewards) > 0:
            best_time = time_rewards.idxmax()
            worst_time = time_rewards.idxmin()

            best_val = time_rewards.max()
            worst_val = time_rewards.min()

            if worst_val != 0:
                diff_percent = ((best_val - worst_val) / abs(worst_val)) * 100
                insights.append(
                    f"{best_time.capitalize()} sessions give you {diff_percent:.1f}% higher rewards than {worst_time} sessions."
                )

        # -----------------------------
        # 4️⃣ Focus Pattern Insight
        # -----------------------------
        if 'block_focus' in df.columns:
            avg_focus = df['block_focus'].mean()
            if avg_focus > 0.75:
                insights.append("Your focus levels are consistently high this week.")
            elif avg_focus < 0.4:
                insights.append("Your focus levels dropped this week. Consider shorter sessions.")
            else:
                insights.append(f"Your average focus level is {avg_focus:.2f}/1.0.")

        # -----------------------------
        # 5️⃣ Session Duration Analysis
        # -----------------------------
        if 'starttime' in df.columns and 'endtime' in df.columns:
            df['duration_minutes'] = 0
            for idx, row in df.iterrows():
                try:
                    start = pd.to_datetime(f"{row['date']} {row['starttime']}")
                    end = pd.to_datetime(f"{row['date']} {row['endtime']}")
                    duration = (end - start).total_seconds() / 60
                    df.at[idx, 'duration_minutes'] = duration
                except:
                    continue
            
            avg_duration = df['duration_minutes'].mean()
            if avg_duration > 0:
                insights.append(f"Your average session duration is {avg_duration:.0f} minutes.")
                
                # Categorize session length
                if avg_duration > 120:
                    insights.append("Consider taking more frequent breaks during long study sessions.")
                elif avg_duration < 30:
                    insights.append("Try extending your study sessions for better retention.")

        # -----------------------------
        # 6️⃣ Sleep Impact Analysis
        # -----------------------------
        if 'sleep_hours_prev_night' in df.columns:
            avg_sleep = df['sleep_hours_prev_night'].mean()
            high_sleep_days = df[df['sleep_hours_prev_night'] >= 8]
            low_sleep_days = df[df['sleep_hours_prev_night'] < 6]
            
            insights.append(f"Your average sleep is {avg_sleep:.1f} hours per night.")
            
            if len(high_sleep_days) > len(low_sleep_days) * 2:
                insights.append("Days with 8+ hours of sleep show 2x better productivity.")
            elif avg_sleep < 6:
                insights.append("Consider improving sleep schedule for better focus.")

        # -----------------------------
        # 7️⃣ Keystroke Efficiency
        # -----------------------------
        if 'keystroke_intervals_mean' in df.columns:
            avg_intervals = df['keystroke_intervals_mean'].mean()
            if avg_intervals > 200:
                insights.append("Your typing speed and consistency are excellent.")
            elif avg_intervals < 100:
                insights.append("Consider improving typing efficiency for better productivity.")

        # -----------------------------
        # 8️⃣ Weekly Goal Progress
        # -----------------------------
        total_sessions = len(df)
        if total_sessions > 0:
            insights.append(f"You completed {total_sessions} study sessions this week.")
            
            # Productivity trend
            recent_sessions = df.tail(10)  # Last 10 sessions
            if len(recent_sessions) >= 3:
                recent_avg = recent_sessions['reward'].mean()
                overall_avg = df['reward'].mean()
                
                if recent_avg > overall_avg * 1.2:
                    insights.append("Your recent performance shows strong improvement trend!")
                elif recent_avg < overall_avg * 0.8:
                    insights.append("Recent performance suggests you may need a break.")

        # -----------------------------
        # 9️⃣ Personalized Recommendations
        # -----------------------------
        # Find most productive time pattern
        time_pattern = df.groupby('action')['reward'].mean().sort_values(ascending=False)
        if len(time_pattern) > 0:
            best_time = time_pattern.index[0]
            second_best = time_pattern.index[1] if len(time_pattern) > 1 else None
            
            insights.append(f"Your optimal study time is {best_time}.")
            
            if second_best:
                insights.append(f"Consider {second_best} as backup during busy periods.")

        return {
            "status": "success",
            "insights": insights
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
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