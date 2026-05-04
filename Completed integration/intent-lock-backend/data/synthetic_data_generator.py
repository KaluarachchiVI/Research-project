"""Generate synthetic training samples for intent-lock."""

from __future__ import annotations

import random

from data.database import clear_training_data, init_database, insert_training_sample


def _label_for(session_minutes: float, latent_mean: float) -> int:
    # Higher load and very short sessions are more likely impulsive.
    score = 0.65 * latent_mean + 0.35 * max(0.0, (20.0 - session_minutes) / 20.0)
    return 1 if score >= 0.52 else 0


def generate_synthetic_data(num_samples: int = 500, *, seed: int = 42) -> None:
    if num_samples <= 0:
        raise ValueError("num_samples must be positive")

    random.seed(seed)
    init_database()
    clear_training_data()

    for _ in range(num_samples):
        session_minutes = random.uniform(5.0, 120.0)
        latent_mean = random.uniform(0.02, 0.98)
        label = _label_for(session_minutes, latent_mean)

        # Add small label noise to avoid a too-perfect synthetic boundary.
        if random.random() < 0.08:
            label = 1 - label

        insert_training_sample(session_minutes, latent_mean, label)

    print(f"Generated {num_samples} synthetic training samples.")

