"""
Research-Backed Synthetic Data Generator for Intent-Lock System

Based on:
1. Cognitive Load Theory (Sweller, 1988): High cognitive load leads to task abandonment
2. Attention Span Research: Average focused attention is 20-30 minutes
3. Study Session Patterns: Optimal study sessions are 25-50 minutes (Pomodoro technique)
4. Exit Behavior Patterns: Users exit due to cognitive overload or task completion

Label Assignment Rules (Research-Backed):
- High cognitive load (>0.7) + Long session (>45 min) → Impulsive (overwhelmed)
- High cognitive load (>0.7) + Short session (<25 min) → Impulsive (quickly overwhelmed)
- Low cognitive load (<0.3) + Short session (<25 min) → Genuine (task completed)
- Low cognitive load (<0.3) + Long session (>45 min) → Genuine (productive session)
- Medium cases → Probabilistic based on research thresholds
"""

import numpy as np
import sys
import os

# Add parent directory to path to import database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.database import init_database, insert_training_data

def generate_synthetic_data(num_samples: int = 500):
    """
    Generate research-backed synthetic training data
    
    Research-Based Distributions:
    - Session Duration: Bimodal distribution (short sessions 15-30 min, long 45-90 min)
    - Cognitive Load: Beta distribution (α=2, β=3) - realistic cognitive load patterns
    - Labels: Based on Cognitive Load Theory and attention span research
    
    Args:
        num_samples: Number of training samples to generate (minimum 100 recommended)
    """
    if num_samples < 100:
        print(f"Warning: Recommended minimum 100 samples. Generating {num_samples} samples.")
    
    np.random.seed(42)  # For reproducibility
    
    # Initialize database
    init_database()
    
    samples = []
    
    # Research-based thresholds
    HIGH_COGNITIVE_LOAD = 0.7
    LOW_COGNITIVE_LOAD = 0.3
    SHORT_SESSION = 25  # Based on attention span research (20-30 min)
    LONG_SESSION = 45   # Based on Pomodoro technique (25-50 min optimal)
    
    # Generate samples with research-backed distributions
    for i in range(num_samples):
        # Session duration: Bimodal distribution
        # 40% short sessions (5-30 min), 40% medium (30-60 min), 20% long (60-120 min)
        rand = np.random.random()
        if rand < 0.4:
            session_minutes = np.random.uniform(5, 30)  # Short sessions
        elif rand < 0.8:
            session_minutes = np.random.uniform(30, 60)  # Medium sessions
        else:
            session_minutes = np.random.uniform(60, 120)  # Long sessions
        
        # Cognitive load: Beta distribution (realistic pattern)
        # Beta(2, 3) gives mean ~0.4, slightly left-skewed (most sessions have moderate load)
        latent_mean = np.random.beta(2, 3)
        
        # Label assignment based on Cognitive Load Theory and research
        # Rule 1: High cognitive load scenarios → Impulsive
        if latent_mean > HIGH_COGNITIVE_LOAD:
            if session_minutes > LONG_SESSION:
                # High load + long session → Impulsive (overwhelmed after extended period)
                label = 1
            elif session_minutes < SHORT_SESSION:
                # High load + short session → Impulsive (quickly overwhelmed)
                label = 1
            else:
                # High load + medium session → Mostly impulsive (80% chance)
                label = 1 if np.random.random() < 0.8 else 0
        
        # Rule 2: Low cognitive load scenarios → Genuine
        elif latent_mean < LOW_COGNITIVE_LOAD:
            if session_minutes < SHORT_SESSION:
                # Low load + short session → Genuine (task completed efficiently)
                label = 0
            elif session_minutes > LONG_SESSION:
                # Low load + long session → Genuine (productive extended session)
                label = 0
            else:
                # Low load + medium session → Mostly genuine (85% chance)
                label = 0 if np.random.random() < 0.85 else 1
        
        # Rule 3: Medium cognitive load (0.3 - 0.7) → Probabilistic
        else:
            # Probability increases with:
            # - Higher cognitive load
            # - Longer session duration (fatigue factor)
            # Research: Medium load + very long sessions tend to be impulsive
            load_factor = (latent_mean - LOW_COGNITIVE_LOAD) / (HIGH_COGNITIVE_LOAD - LOW_COGNITIVE_LOAD)
            duration_factor = min(session_minutes / 120, 1.0)  # Normalize to 0-1
            
            # Base probability: 30% impulsive, increases with load and duration
            impulsive_prob = 0.3 + (load_factor * 0.3) + (duration_factor * 0.2)
            
            # Add noise for realistic variation
            impulsive_prob += np.random.normal(0, 0.1)
            impulsive_prob = np.clip(impulsive_prob, 0.1, 0.9)  # Keep in reasonable range
            
            label = 1 if np.random.random() < impulsive_prob else 0
        
        # Insert into database
        insert_training_data(session_minutes, latent_mean, label)
        samples.append((session_minutes, latent_mean, label))
    
    # Calculate and print statistics
    impulsive_count = sum(1 for _, _, label in samples if label == 1)
    genuine_count = num_samples - impulsive_count
    
    # Calculate statistics by category
    high_load_impulsive = sum(1 for s, l, lab in samples if l > HIGH_COGNITIVE_LOAD and lab == 1)
    high_load_genuine = sum(1 for s, l, lab in samples if l > HIGH_COGNITIVE_LOAD and lab == 0)
    low_load_impulsive = sum(1 for s, l, lab in samples if l < LOW_COGNITIVE_LOAD and lab == 1)
    low_load_genuine = sum(1 for s, l, lab in samples if l < LOW_COGNITIVE_LOAD and lab == 0)
    
    print("\n" + "="*60)
    print("RESEARCH-BACKED SYNTHETIC DATA GENERATION COMPLETE")
    print("="*60)
    print(f"\nTotal samples generated: {num_samples}")
    print(f"\nOverall Distribution:")
    print(f"  - Impulsive exits: {impulsive_count} ({impulsive_count/num_samples*100:.1f}%)")
    print(f"  - Genuine exits: {genuine_count} ({genuine_count/num_samples*100:.1f}%)")
    
    print(f"\nFeature Ranges:")
    print(f"  - Session minutes: {min(s[0] for s in samples):.1f} - {max(s[0] for s in samples):.1f}")
    print(f"  - Cognitive load (latent_mean): {min(s[1] for s in samples):.3f} - {max(s[1] for s in samples):.3f}")
    
    print(f"\nResearch-Based Category Analysis:")
    print(f"  High Cognitive Load (>0.7):")
    print(f"    - Impulsive: {high_load_impulsive} ({high_load_impulsive/(high_load_impulsive+high_load_genuine)*100:.1f}%)")
    print(f"    - Genuine: {high_load_genuine} ({high_load_genuine/(high_load_impulsive+high_load_genuine)*100:.1f}%)")
    print(f"  Low Cognitive Load (<0.3):")
    print(f"    - Impulsive: {low_load_impulsive} ({low_load_impulsive/(low_load_impulsive+low_load_genuine)*100:.1f}%)")
    print(f"    - Genuine: {low_load_genuine} ({low_load_genuine/(low_load_impulsive+low_load_genuine)*100:.1f}%)")
    
    print(f"\n✅ Data saved to database successfully!")
    print("="*60)
    
    return samples

if __name__ == "__main__":
    # Generate 500 samples (research shows 100+ samples needed for reliable model)
    # Adjust as needed, but minimum 100 recommended
    generate_synthetic_data(500)

