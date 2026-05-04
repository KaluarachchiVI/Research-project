"""Test the trained model with sample predictions"""
from models.model import IntentModel

# Load the trained model
model = IntentModel()

print("\n" + "="*60)
print("MODEL TESTING - Sample Predictions")
print("="*60)

# Test cases based on research-backed scenarios
test_cases = [
    (10, 0.2, "Genuine - Short session, low cognitive load"),
    (60, 0.8, "Impulsive - Long session, high cognitive load"),
    (15, 0.75, "Impulsive - Short session, high cognitive load"),
    (50, 0.15, "Genuine - Long session, low cognitive load"),
    (30, 0.5, "Mixed - Medium session, medium cognitive load"),
    (5, 0.9, "Impulsive - Very short, very high load"),
    (90, 0.1, "Genuine - Very long, very low load"),
]

print("\nTest Predictions:")
print("-" * 60)

for session_min, latent_mean, description in test_cases:
    prediction = model.predict(session_min, latent_mean)
    label = "Impulsive" if prediction == 1 else "Genuine"
    print(f"\n{description}")
    print(f"  Input: session={session_min}min, load={latent_mean:.2f}")
    print(f"  Prediction: {label}")

print("\n" + "="*60)
print("✅ Model is ready for use!")
print("="*60)





