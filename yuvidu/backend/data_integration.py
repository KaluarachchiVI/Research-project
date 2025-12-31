"""Integration script to convert exporter data to yuvidu format and update the dataset."""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataIntegrator:
    """Handles integration between cog_py_est exporter and yuvidu bandit model."""
    
    def __init__(self, exporter_db_path: str = "yuvindu_data.db", 
                 yuvidu_dataset_path: str = "large_contextual_bandit_dataset.csv"):
        self.exporter_db_path = exporter_db_path
        self.yuvidu_dataset_path = yuvidu_dataset_path
        
    def extract_time_features(self, window_end: str) -> dict:
        """Extract time-based features from ISO timestamp."""
        dt = datetime.fromisoformat(window_end.replace('Z', '+00:00'))
        
        # Extract time of day (hour in 24h format)
        hour = dt.hour
        
        # Map to action based on time of day
        if 6 <= hour < 12:
            action = 'morning'
        elif 12 <= hour < 18:
            action = 'afternoon'
        elif 18 <= hour < 22:
            action = 'evening'
        else:
            action = 'night'
            
        # Simulate sleep hours (this would ideally come from actual sleep data)
        # For now, estimate based on time of day
        if action == 'morning':
            sleep_hours = np.random.normal(7, 1)  # 7±1 hours sleep
        elif action == 'afternoon':
            sleep_hours = np.random.normal(6.5, 1.5)
        elif action == 'evening':
            sleep_hours = np.random.normal(6, 1.5)
        else:  # night
            sleep_hours = np.random.normal(5, 2)
            
        sleep_hours = max(0, min(12, sleep_hours))  # Clamp between 0-12 hours
        
        return {
            'action': action,
            'sleep_hours_prev_night': sleep_hours,
            'hour_of_day': hour
        }
    
    def calculate_reward(self, row: dict, time_features: dict) -> float:
        """Calculate reward based on performance metrics and time of day."""
        # Base reward from performance metrics
        # Lower keystroke intervals (faster typing) = higher reward
        keystroke_score = 1.0 / (1.0 + row['keystroke_intervals_mean'] / 1000.0)
        
        # Moderate burstiness is good (not too high, not too low)
        burstiness_score = 1.0 - abs(row['burstiness'] - 0.5)
        
        # Moderate scroll rate is good
        scroll_score = 1.0 - abs(row['scroll_rate'] - 50) / 100.0
        
        # Lower idle time is better
        idle_score = 1.0 - row['idle_time_percent']
        
        # EMA rating if available (normalized to 0-1)
        ema_score = 0.5  # default if no EMA
        if row['microEMA_rating'] is not None:
            ema_score = (row['microEMA_rating'] - 1) / 6.0  # Convert 1-7 scale to 0-1
        
        # Time-of-day preference (simulate different performance at different times)
        time_preference = {
            'morning': 0.8,
            'afternoon': 0.7,
            'evening': 0.6,
            'night': 0.4
        }
        
        time_bonus = time_preference.get(time_features['action'], 0.5)
        
        # Combine all scores
        base_reward = (
            keystroke_score * 0.3 +
            burstiness_score * 0.2 +
            scroll_score * 0.15 +
            idle_score * 0.2 +
            ema_score * 0.15
        )
        
        # Apply time preference bonus
        final_reward = base_reward * (0.7 + 0.3 * time_bonus)
        
        # Add some noise to make it more realistic
        noise = np.random.normal(0, 0.05)
        final_reward = max(0, min(1, final_reward + noise))
        
        return final_reward
    
    def convert_block_focus(self, focus_app: str) -> float:
        """Convert block_focus string to numeric value."""
        # Simple heuristic: convert to a hash and normalize
        if focus_app == 'unknown':
            return 0.5
        elif focus_app == 'error':
            return 0.0
        else:
            # Use a simple hash function to get consistent numeric values
            hash_val = hash(focus_app) % 1000
            return hash_val / 1000.0
    
    def load_exporter_data(self) -> pd.DataFrame:
        """Load data from the exporter SQLite database."""
        if not Path(self.exporter_db_path).exists():
            logger.warning(f"Exporter database {self.exporter_db_path} not found")
            return pd.DataFrame()
            
        conn = sqlite3.connect(self.exporter_db_path)
        query = """
        SELECT session_id, window_start, window_end, block_focus,
               keystroke_intervals_mean, burstiness, scroll_rate,
               idle_time_percent, microEMA_rating, microEMA_note
        FROM exported_metrics
        ORDER BY window_end
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        logger.info(f"Loaded {len(df)} records from exporter database")
        return df
    
    def load_yuvidu_dataset(self) -> pd.DataFrame:
        """Load existing yuvidu dataset."""
        if not Path(self.yuvidu_dataset_path).exists():
            logger.warning(f"Yuvidu dataset {self.yuvidu_dataset_path} not found")
            # Create empty dataset with correct columns
            columns = [
                'block_focus', 'keystroke_intervals_mean', 'burstiness',
                'scroll_rate', 'idle_time_percent', 'microEMA',
                'sleep_hours_prev_night', 'action', 'reward'
            ]
            return pd.DataFrame(columns=columns)
            
        df = pd.read_csv(self.yuvidu_dataset_path)
        logger.info(f"Loaded {len(df)} records from yuvidu dataset")
        return df
    
    def integrate_data(self) -> pd.DataFrame:
        """Convert exporter data to yuvidu format."""
        exporter_df = self.load_exporter_data()
        yuvidu_df = self.load_yuvidu_dataset()
        
        if exporter_df.empty:
            logger.warning("No exporter data to integrate")
            return yuvidu_df
            
        # Convert exporter data to yuvidu format
        converted_rows = []
        
        for _, row in exporter_df.iterrows():
            # Extract time features
            time_features = self.extract_time_features(row['window_end'])
            
            # Convert block_focus to numeric
            block_focus_numeric = self.convert_block_focus(row['block_focus'])
            
            # Convert EMA rating to numeric (normalize to 0-1)
            microEMA_numeric = 0.5  # default
            if row['microEMA_rating'] is not None:
                microEMA_numeric = (row['microEMA_rating'] - 1) / 6.0
            
            # Calculate reward
            reward = self.calculate_reward(row.to_dict(), time_features)
            
            # Create yuvidu format row
            yuvidu_row = {
                'block_focus': block_focus_numeric,
                'keystroke_intervals_mean': row['keystroke_intervals_mean'],
                'burstiness': row['burstiness'],
                'scroll_rate': row['scroll_rate'],
                'idle_time_percent': row['idle_time_percent'],
                'microEMA': microEMA_numeric,
                'sleep_hours_prev_night': time_features['sleep_hours_prev_night'],
                'action': time_features['action'],
                'reward': reward
            }
            
            converted_rows.append(yuvidu_row)
        
        # Create DataFrame from converted rows
        new_df = pd.DataFrame(converted_rows)
        
        # Combine with existing data
        if not yuvidu_df.empty:
            combined_df = pd.concat([yuvidu_df, new_df], ignore_index=True)
        else:
            combined_df = new_df
            
        logger.info(f"Integrated {len(new_df)} new records. Total: {len(combined_df)} records")
        return combined_df
    
    def update_dataset(self, backup: bool = True) -> None:
        """Update the yuvidu dataset with new data from exporter."""
        if backup and Path(self.yuvidu_dataset_path).exists():
            # Create backup
            backup_path = self.yuvidu_dataset_path.replace('.csv', '_backup.csv')
            pd.read_csv(self.yuvidu_dataset_path).to_csv(backup_path, index=False)
            logger.info(f"Created backup: {backup_path}")
        
        # Integrate data
        updated_df = self.integrate_data()
        
        # Save updated dataset
        updated_df.to_csv(self.yuvidu_dataset_path, index=False)
        logger.info(f"Updated dataset saved to {self.yuvidu_dataset_path}")
        
        # Show statistics
        logger.info("Dataset statistics:")
        logger.info(f"Total records: {len(updated_df)}")
        logger.info(f"Action distribution: {updated_df['action'].value_counts().to_dict()}")
        logger.info(f"Average reward: {updated_df['reward'].mean():.3f}")
        logger.info(f"Reward by action: {updated_df.groupby('action')['reward'].mean().to_dict()}")

def main():
    """Main function to run data integration."""
    integrator = DataIntegrator()
    integrator.update_dataset()

if __name__ == "__main__":
    main()
