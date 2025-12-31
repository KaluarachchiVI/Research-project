"""Script to update the bandit model with new data and retrain."""

import pandas as pd
import numpy as np
from mabwiser.mab import MAB, LearningPolicy
from pathlib import Path
import logging
from data_integration import DataIntegrator

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelUpdater:
    """Handles updating the bandit model with new data."""
    
    def __init__(self, dataset_path: str = "large_contextual_bandit_dataset.csv"):
        self.dataset_path = dataset_path
        self.context_features = [
            'block_focus',
            'keystroke_intervals_mean',
            'burstiness',
            'scroll_rate',
            'idle_time_percent',
            'microEMA',
            'sleep_hours_prev_night'
        ]
        self.arm_mapping = {'morning': 0, 'afternoon': 1, 'evening': 2, 'night': 3}
        self.inverse_mapping = {v: k for k, v in self.arm_mapping.items()}
        
    def load_and_prepare_data(self) -> tuple:
        """Load dataset and prepare for training."""
        if not Path(self.dataset_path).exists():
            raise FileNotFoundError(f"Dataset {self.dataset_path} not found")
            
        df = pd.read_csv(self.dataset_path)
        logger.info(f"Loaded {len(df)} records for training")
        
        # Extract features and target
        actions_encoded = df['action'].map(self.arm_mapping).astype(int)
        rewards_array = df['reward'].astype(float).values
        context_df = df[self.context_features].astype(float)
        
        return actions_encoded, rewards_array, context_df
    
    def train_model(self) -> MAB:
        """Train the bandit model."""
        actions_encoded, rewards_array, context_df = self.load_and_prepare_data()
        
        # Initialize and train model
        mab = MAB(
            arms=[0, 1, 2, 3],
            learning_policy=LearningPolicy.LinUCB(alpha=1.25)
        )
        
        mab.partial_fit(actions_encoded, rewards_array, context_df.values)
        logger.info("Bandit model trained successfully")
        
        return mab
    
    def update_and_save_model(self, model_save_path: str = "trained_bandit_model.pkl"):
        """Update model with new data and save."""
        # First integrate new data
        integrator = DataIntegrator()
        integrator.update_dataset()
        
        # Train new model
        mab = self.train_model()
        
        # Save model (optional - you could also just retrain on demand)
        import pickle
        with open(model_save_path, 'wb') as f:
            pickle.dump(mab, f)
        logger.info(f"Model saved to {model_save_path}")
        
        return mab
    
    def get_model_statistics(self, mab: MAB) -> dict:
        """Get statistics about the trained model."""
        actions_encoded, rewards_array, context_df = self.load_and_prepare_data()
        
        # Get average context
        avg_context = context_df.mean().values.reshape(1, -1)
        
        # Get predictions for all arms
        expectations = mab.predict_expectations(avg_context)
        
        stats = {
            'total_samples': len(actions_encoded),
            'average_reward': np.mean(rewards_array),
            'action_distribution': pd.Series(actions_encoded).map(self.inverse_mapping).value_counts().to_dict(),
            'expected_rewards': {self.inverse_mapping[arm]: float(expectations[arm]) 
                               for arm in mab.arms}
        }
        
        return stats

def main():
    """Main function to update the model."""
    updater = ModelUpdater()
    
    # Update model with new data
    mab = updater.update_and_save_model()
    
    # Get and display statistics
    stats = updater.get_model_statistics(mab)
    
    logger.info("Model Update Complete!")
    logger.info(f"Total samples: {stats['total_samples']}")
    logger.info(f"Average reward: {stats['average_reward']:.3f}")
    logger.info("Action distribution:")
    for action, count in stats['action_distribution'].items():
        logger.info(f"  {action}: {count}")
    logger.info("Expected rewards:")
    for action, reward in stats['expected_rewards'].items():
        logger.info(f"  {action}: {reward:.3f}")

if __name__ == "__main__":
    main()
