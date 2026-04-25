import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
import os
import sys

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.database import get_training_data, init_database

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'intent_model.joblib')

class IntentModel:
    def __init__(self, auto_generate_data: bool = True):
        """
        Initialize Intent Model
        
        Args:
            auto_generate_data: If True, automatically generate synthetic data if database is empty
        """
        # Initialize database if needed
        init_database()
        
        if os.path.exists(MODEL_PATH):
            # Load existing model
            self.model = joblib.load(MODEL_PATH)
            print("Loaded existing model from file")
        else:
            # Train new model from database
            training_data = get_training_data()
            
            if len(training_data) == 0:
                if auto_generate_data:
                    # Automatically generate research-backed synthetic data
                    print("No training data found in database.")
                    print("Generating research-backed synthetic training data...")
                    try:
                        from data.synthetic_data_generator import generate_synthetic_data
                        # Generate 500 samples (research-backed, minimum 100 recommended)
                        generate_synthetic_data(500)
                        # Reload training data after generation
                        training_data = get_training_data()
                        print(f"✅ Generated and loaded {len(training_data)} training samples")
                    except Exception as e:
                        print(f"Error generating synthetic data: {e}")
                        print("Falling back to minimal synthetic data...")
                        # Minimal fallback (should not happen if generator works)
                        X = np.array([
                            [15, 0.8],  # Short session, high load → impulsive
                            [20, 0.75], # Short session, high load → impulsive
                            [10, 0.2],  # Short session, low load → genuine
                            [50, 0.15], # Long session, low load → genuine
                            [60, 0.75], # Long session, high load → impulsive
                            [30, 0.5],  # Medium session, medium load → mixed
                        ])
                        y = np.array([1, 1, 0, 0, 1, 0])  # 1 = impulsive, 0 = genuine
                        training_data = [(X[i][0], X[i][1], y[i]) for i in range(len(X))]
                else:
                    raise ValueError(
                        "No training data in database. "
                        "Run 'python data/synthetic_data_generator.py' to generate data, "
                        "or set auto_generate_data=True"
                    )
            
            if len(training_data) > 0:
                # Load from database
                X = np.array([[row[0], row[1]] for row in training_data])  # session_minutes, latent_mean
                y = np.array([row[2] for row in training_data])  # label
                print(f"Training model with {len(training_data)} samples from database")
                
                # Train model
                self.model = LogisticRegression(random_state=42, max_iter=1000)
                self.model.fit(X, y)
                joblib.dump(self.model, MODEL_PATH)
                print(f"✅ Model trained and saved to {MODEL_PATH}")
                
                # Print model statistics
                impulsive_count = sum(1 for label in y if label == 1)
                genuine_count = len(y) - impulsive_count
                print(f"   Training set: {impulsive_count} impulsive, {genuine_count} genuine")
            else:
                raise ValueError("Failed to load or generate training data")

    def predict(self, session_minutes: float, latent_mean: float) -> int:
        """
        Predict exit intent
        
        Args:
            session_minutes: Duration of study session in minutes
            latent_mean: Cognitive load score (0-1)
        
        Returns:
            0 for genuine exit, 1 for impulsive exit
        """
        prediction = self.model.predict([[session_minutes, latent_mean]])
        return int(prediction[0])