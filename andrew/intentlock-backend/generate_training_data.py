"""
Helper script to generate research-backed synthetic training data

Usage:
    python generate_training_data.py [num_samples]

Examples:
    python generate_training_data.py          # Generate 500 samples (default)
    python generate_training_data.py 1000    # Generate 1000 samples
    python generate_training_data.py 200     # Generate 200 samples
"""

import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data.synthetic_data_generator import generate_synthetic_data

if __name__ == "__main__":
    # Get number of samples from command line or use default
    if len(sys.argv) > 1:
        try:
            num_samples = int(sys.argv[1])
            if num_samples < 100:
                print(f"⚠️  Warning: Minimum 100 samples recommended for reliable model training.")
                print(f"   Generating {num_samples} samples as requested...\n")
        except ValueError:
            print("Error: Number of samples must be an integer")
            print("Usage: python generate_training_data.py [num_samples]")
            sys.exit(1)
    else:
        num_samples = 500  # Default: research-backed minimum
    
    # Generate data
    generate_synthetic_data(num_samples)
    
    print("\n💡 Tip: Delete 'models/intent_model.joblib' to retrain model with new data")

