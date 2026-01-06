"""Evaluate model accuracy on training data"""
from models.model import IntentModel
from data.database import get_training_data
import numpy as np

# Load model and training data
model = IntentModel()
training_data = get_training_data()

if len(training_data) == 0:
    print("No training data found!")
    exit(1)

# Prepare data
X = np.array([[row[0], row[1]] for row in training_data])
y_true = np.array([row[2] for row in training_data])

# Get predictions
y_pred = np.array([model.predict(x[0], x[1]) for x in X])

# Calculate accuracy
accuracy = np.mean(y_true == y_pred)

# Calculate per-class accuracy
impulsive_mask = y_true == 1
genuine_mask = y_true == 0

impulsive_accuracy = np.mean(y_pred[impulsive_mask] == y_true[impulsive_mask]) if np.any(impulsive_mask) else 0
genuine_accuracy = np.mean(y_pred[genuine_mask] == y_true[genuine_mask]) if np.any(genuine_mask) else 0

# Confusion matrix
tp = np.sum((y_true == 1) & (y_pred == 1))  # True Impulsive
tn = np.sum((y_true == 0) & (y_pred == 0))  # True Genuine
fp = np.sum((y_true == 0) & (y_pred == 1))  # False Impulsive
fn = np.sum((y_true == 1) & (y_pred == 0))  # False Genuine

print("\n" + "="*60)
print("MODEL EVALUATION - Training Data Accuracy")
print("="*60)
print(f"\nTotal Training Samples: {len(training_data)}")
print(f"  - Impulsive exits: {np.sum(y_true == 1)}")
print(f"  - Genuine exits: {np.sum(y_true == 0)}")

print(f"\n📊 Overall Accuracy: {accuracy*100:.2f}%")
print(f"\nPer-Class Accuracy:")
print(f"  - Impulsive exits: {impulsive_accuracy*100:.2f}%")
print(f"  - Genuine exits: {genuine_accuracy*100:.2f}%")

print(f"\nConfusion Matrix:")
print(f"  True Impulsive (TP):  {tp}")
print(f"  True Genuine (TN):    {tn}")
print(f"  False Impulsive (FP): {fp}")
print(f"  False Genuine (FN):   {fn}")

# Calculate precision, recall, F1
precision = tp / (tp + fp) if (tp + fp) > 0 else 0
recall = tp / (tp + fn) if (tp + fn) > 0 else 0
f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

print(f"\n📈 Additional Metrics:")
print(f"  Precision: {precision*100:.2f}%")
print(f"  Recall:    {recall*100:.2f}%")
print(f"  F1-Score:  {f1*100:.2f}%")

print("\n" + "="*60)
print("✅ Model evaluation complete!")
print("="*60)


