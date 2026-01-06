"""
Database Inspection Tool for Intent-Lock System

This script provides comprehensive database analysis to verify:
- Schema structure
- Data quality
- Training data distribution
- Exit events statistics
- Prediction accuracy verification
"""

import sqlite3
import os
import sys
from datetime import datetime
from typing import List, Tuple

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from data.database import DB_PATH, get_connection

def print_section(title: str, width: int = 80):
    """Print a formatted section header"""
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)

def inspect_schema():
    """Inspect database schema"""
    print_section("DATABASE SCHEMA INSPECTION")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print(f"\nFound {len(tables)} tables:\n")
    
    for (table_name,) in tables:
        print(f"📋 Table: {table_name}")
        print("-" * 60)
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        print(f"{'Column':<20} {'Type':<15} {'Nullable':<10} {'Default':<15}")
        print("-" * 60)
        
        for col in columns:
            col_id, name, col_type, not_null, default_val, pk = col
            nullable = "NO" if not_null else "YES"
            default = str(default_val) if default_val else "NULL"
            print(f"{name:<20} {col_type:<15} {nullable:<10} {default:<15}")
        
        # Get foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({table_name})")
        foreign_keys = cursor.fetchall()
        
        if foreign_keys:
            print("\nForeign Keys:")
            for fk in foreign_keys:
                print(f"  → {fk[3]} references {fk[2]}.{fk[4]}")
        
        print()
    
    conn.close()

def inspect_training_data():
    """Inspect synthetic training data"""
    print_section("TRAINING DATA ANALYSIS")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total count
    cursor.execute("SELECT COUNT(*) FROM synthetic_training_data")
    total = cursor.fetchone()[0]
    
    if total == 0:
        print("⚠️  No training data found in database!")
        print("   Run: python data/synthetic_data_generator.py")
        conn.close()
        return
    
    print(f"\n📊 Total Training Samples: {total}")
    
    # Label distribution
    cursor.execute("""
        SELECT 
            label,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM synthetic_training_data), 2) as percentage
        FROM synthetic_training_data
        GROUP BY label
    """)
    
    print("\nLabel Distribution:")
    print("-" * 60)
    for label, count, pct in cursor.fetchall():
        label_name = "Impulsive (1)" if label == 1 else "Genuine (0)"
        print(f"  {label_name:<20} {count:>5} samples ({pct:>5.1f}%)")
    
    # Feature statistics
    cursor.execute("""
        SELECT 
            MIN(session_minutes) as min_session,
            MAX(session_minutes) as max_session,
            AVG(session_minutes) as avg_session,
            MIN(latent_mean) as min_load,
            MAX(latent_mean) as max_load,
            AVG(latent_mean) as avg_load
        FROM synthetic_training_data
    """)
    
    stats = cursor.fetchone()
    print("\nFeature Statistics:")
    print("-" * 60)
    print(f"  Session Minutes:")
    print(f"    Min:  {stats[0]:.2f}")
    print(f"    Max:  {stats[1]:.2f}")
    print(f"    Avg:  {stats[2]:.2f}")
    print(f"  Cognitive Load (latent_mean):")
    print(f"    Min:  {stats[3]:.3f}")
    print(f"    Max:  {stats[4]:.3f}")
    print(f"    Avg:  {stats[5]:.3f}")
    
    # Category analysis
    cursor.execute("""
        SELECT 
            CASE 
                WHEN latent_mean > 0.7 THEN 'High Load (>0.7)'
                WHEN latent_mean < 0.3 THEN 'Low Load (<0.3)'
                ELSE 'Medium Load (0.3-0.7)'
            END as load_category,
            label,
            COUNT(*) as count
        FROM synthetic_training_data
        GROUP BY load_category, label
        ORDER BY load_category, label
    """)
    
    print("\nCognitive Load Category Analysis:")
    print("-" * 60)
    current_category = None
    for category, label, count in cursor.fetchall():
        if category != current_category:
            if current_category is not None:
                print()
            print(f"  {category}:")
            current_category = category
        label_name = "Impulsive" if label == 1 else "Genuine"
        print(f"    {label_name}: {count} samples")
    
    # Sample data
    cursor.execute("""
        SELECT session_minutes, latent_mean, label 
        FROM synthetic_training_data 
        LIMIT 10
    """)
    
    print("\nSample Training Data (first 10 rows):")
    print("-" * 60)
    print(f"{'Session (min)':<15} {'Load':<10} {'Label':<10}")
    print("-" * 60)
    for session, load, label in cursor.fetchall():
        label_name = "Impulsive" if label == 1 else "Genuine"
        print(f"{session:<15.2f} {load:<10.3f} {label_name:<10}")
    
    conn.close()

def inspect_exit_events():
    """Inspect exit events log"""
    print_section("EXIT EVENTS ANALYSIS")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total count
    cursor.execute("SELECT COUNT(*) FROM exit_events")
    total = cursor.fetchone()[0]
    
    if total == 0:
        print("📝 No exit events logged yet.")
        print("   Events will be logged when users attempt to exit.")
        conn.close()
        return
    
    print(f"\n📊 Total Exit Events: {total}")
    
    # Prediction distribution
    cursor.execute("""
        SELECT 
            prediction,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM exit_events), 2) as percentage
        FROM exit_events
        GROUP BY prediction
    """)
    
    print("\nPrediction Distribution:")
    print("-" * 60)
    for pred, count, pct in cursor.fetchall():
        print(f"  {pred.capitalize():<15} {count:>5} events ({pct:>5.1f}%)")
    
    # Friction level distribution
    cursor.execute("""
        SELECT 
            friction_level,
            COUNT(*) as count
        FROM exit_events
        GROUP BY friction_level
        ORDER BY friction_level
    """)
    
    print("\nFriction Level Distribution:")
    print("-" * 60)
    friction_names = {0: "Level 0 (Gentle)", 1: "Level 1 (Reason)", 2: "Level 2 (Countdown)"}
    for level, count in cursor.fetchall():
        level_name = friction_names.get(level, f"Level {level}")
        print(f"  {level_name:<25} {count:>5} events")
    
    # Recent events
    cursor.execute("""
        SELECT 
            timestamp,
            session_minutes,
            latent_mean,
            prediction,
            friction_level,
            allowed_exit
        FROM exit_events
        ORDER BY timestamp DESC
        LIMIT 10
    """)
    
    print("\nRecent Exit Events (last 10):")
    print("-" * 60)
    print(f"{'Timestamp':<20} {'Session':<10} {'Load':<8} {'Prediction':<12} {'Friction':<10} {'Allowed':<8}")
    print("-" * 60)
    for row in cursor.fetchall():
        ts, sess, load, pred, friction, allowed = row
        # Format timestamp
        try:
            dt = datetime.fromisoformat(ts)
            ts_formatted = dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            ts_formatted = ts[:19]
        allowed_str = "Yes" if allowed else "No"
        print(f"{ts_formatted:<20} {sess:<10.1f} {load:<8.3f} {pred:<12} {friction:<10} {allowed_str:<8}")
    
    conn.close()

def inspect_exit_reasons():
    """Inspect exit reasons"""
    print_section("EXIT REASONS ANALYSIS")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total count
    cursor.execute("SELECT COUNT(*) FROM exit_reasons")
    total = cursor.fetchone()[0]
    
    if total == 0:
        print("📝 No exit reasons logged yet.")
        print("   Reasons are logged when users select a reason at Friction Level 1.")
        conn.close()
        return
    
    print(f"\n📊 Total Exit Reasons Logged: {total}")
    
    # Reason distribution
    cursor.execute("""
        SELECT 
            reason,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM exit_reasons), 2) as percentage
        FROM exit_reasons
        GROUP BY reason
        ORDER BY count DESC
    """)
    
    print("\nReason Distribution:")
    print("-" * 60)
    for reason, count, pct in cursor.fetchall():
        print(f"  {reason:<20} {count:>5} times ({pct:>5.1f}%)")
    
    # Recent reasons
    cursor.execute("""
        SELECT 
            er.reason,
            er.custom_text,
            ee.timestamp,
            ee.prediction
        FROM exit_reasons er
        JOIN exit_events ee ON er.exit_event_id = ee.id
        ORDER BY ee.timestamp DESC
        LIMIT 10
    """)
    
    print("\nRecent Exit Reasons (last 10):")
    print("-" * 60)
    for reason, custom, timestamp, prediction in cursor.fetchall():
        print(f"  {reason:<15} | Prediction: {prediction:<10} | Custom: {custom or 'N/A'}")
    
    conn.close()

def verify_data_quality():
    """Verify data quality and integrity"""
    print_section("DATA QUALITY VERIFICATION")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    issues = []
    warnings = []
    
    # Check training data
    cursor.execute("SELECT COUNT(*) FROM synthetic_training_data")
    train_count = cursor.fetchone()[0]
    
    if train_count == 0:
        issues.append("❌ No training data found - model cannot be trained")
    elif train_count < 100:
        warnings.append(f"⚠️  Low training data count ({train_count}) - recommend at least 100 samples")
    else:
        print(f"✅ Training data: {train_count} samples")
    
    # Check for null values in training data
    cursor.execute("""
        SELECT COUNT(*) FROM synthetic_training_data 
        WHERE session_minutes IS NULL OR latent_mean IS NULL OR label IS NULL
    """)
    null_count = cursor.fetchone()[0]
    if null_count > 0:
        issues.append(f"❌ Found {null_count} rows with NULL values in training data")
    else:
        print("✅ No NULL values in training data")
    
    # Check label balance
    cursor.execute("""
        SELECT 
            label,
            COUNT(*) as count
        FROM synthetic_training_data
        GROUP BY label
    """)
    label_counts = {label: count for label, count in cursor.fetchall()}
    
    if len(label_counts) == 2:
        impulsive = label_counts.get(1, 0)
        genuine = label_counts.get(0, 0)
        total = impulsive + genuine
        impulsive_pct = (impulsive / total) * 100
        
        if 30 <= impulsive_pct <= 70:
            print(f"✅ Balanced dataset: {impulsive_pct:.1f}% impulsive, {100-impulsive_pct:.1f}% genuine")
        else:
            warnings.append(f"⚠️  Imbalanced dataset: {impulsive_pct:.1f}% impulsive, {100-impulsive_pct:.1f}% genuine")
    
    # Check feature ranges
    cursor.execute("""
        SELECT 
            MIN(session_minutes), MAX(session_minutes),
            MIN(latent_mean), MAX(latent_mean)
        FROM synthetic_training_data
    """)
    min_sess, max_sess, min_load, max_load = cursor.fetchone()
    
    if min_sess < 0 or max_sess > 200:
        warnings.append(f"⚠️  Unusual session range: {min_sess:.1f} - {max_sess:.1f} minutes")
    else:
        print(f"✅ Session range: {min_sess:.1f} - {max_sess:.1f} minutes")
    
    if min_load < 0 or max_load > 1:
        issues.append(f"❌ Invalid cognitive load range: {min_load:.3f} - {max_load:.3f} (should be 0-1)")
    else:
        print(f"✅ Cognitive load range: {min_load:.3f} - {max_load:.3f}")
    
    # Check foreign key integrity
    cursor.execute("""
        SELECT COUNT(*) FROM exit_reasons er
        LEFT JOIN exit_events ee ON er.exit_event_id = ee.id
        WHERE ee.id IS NULL
    """)
    orphaned = cursor.fetchone()[0]
    if orphaned > 0:
        issues.append(f"❌ Found {orphaned} orphaned exit_reasons (missing exit_event)")
    else:
        print("✅ Foreign key integrity: All exit_reasons linked to valid exit_events")
    
    # Print issues and warnings
    if warnings:
        print("\n⚠️  Warnings:")
        for warning in warnings:
            print(f"  {warning}")
    
    if issues:
        print("\n❌ Issues Found:")
        for issue in issues:
            print(f"  {issue}")
    elif not warnings:
        print("\n✅ All data quality checks passed!")
    
    conn.close()

def check_model_accuracy():
    """Check model accuracy on training data"""
    print_section("MODEL ACCURACY VERIFICATION")
    
    try:
        from models.model import IntentModel
        from data.database import get_training_data
        import numpy as np
        
        # Load model
        print("Loading model...")
        model = IntentModel()
        
        # Get training data
        training_data = get_training_data()
        
        if len(training_data) == 0:
            print("⚠️  No training data to verify against")
            return
        
        print(f"Testing on {len(training_data)} training samples...\n")
        
        # Test predictions
        correct = 0
        total = len(training_data)
        impulsive_correct = 0
        impulsive_total = 0
        genuine_correct = 0
        genuine_total = 0
        
        for session_min, latent_mean, true_label in training_data:
            prediction = model.predict(session_min, latent_mean)
            
            if true_label == 1:
                impulsive_total += 1
                if prediction == 1:
                    impulsive_correct += 1
            else:
                genuine_total += 1
                if prediction == 0:
                    genuine_correct += 1
            
            if prediction == true_label:
                correct += 1
        
        # Calculate metrics
        overall_accuracy = (correct / total) * 100
        impulsive_accuracy = (impulsive_correct / impulsive_total * 100) if impulsive_total > 0 else 0
        genuine_accuracy = (genuine_correct / genuine_total * 100) if genuine_total > 0 else 0
        
        print("Accuracy Metrics:")
        print("-" * 60)
        print(f"  Overall Accuracy:     {overall_accuracy:.2f}% ({correct}/{total})")
        print(f"  Impulsive Accuracy:   {impulsive_accuracy:.2f}% ({impulsive_correct}/{impulsive_total})")
        print(f"  Genuine Accuracy:      {genuine_accuracy:.2f}% ({genuine_correct}/{genuine_total})")
        
        # Confusion matrix
        print("\nConfusion Matrix:")
        print("-" * 60)
        print(f"  True Impulsive → Predicted Impulsive: {impulsive_correct}")
        print(f"  True Impulsive → Predicted Genuine:   {impulsive_total - impulsive_correct}")
        print(f"  True Genuine → Predicted Genuine:     {genuine_correct}")
        print(f"  True Genuine → Predicted Impulsive:   {genuine_total - genuine_correct}")
        
        if overall_accuracy >= 70:
            print("\n✅ Model accuracy is acceptable (≥70%)")
        elif overall_accuracy >= 60:
            print("\n⚠️  Model accuracy is moderate (60-70%) - consider more training data")
        else:
            print("\n❌ Model accuracy is low (<60%) - retrain with more/better data")
            
    except Exception as e:
        print(f"❌ Error checking model: {e}")

def main():
    """Main inspection function"""
    print("\n" + "="*80)
    print("  INTENT-LOCK DATABASE INSPECTION TOOL")
    print("="*80)
    print(f"\nDatabase Location: {DB_PATH}")
    print(f"Inspection Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print("\n❌ Database file not found!")
        print(f"   Expected location: {DB_PATH}")
        print("   Run: python data/database.py to initialize")
        return
    
    # Run all inspections
    inspect_schema()
    inspect_training_data()
    inspect_exit_events()
    inspect_exit_reasons()
    verify_data_quality()
    check_model_accuracy()
    
    print("\n" + "="*80)
    print("  INSPECTION COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()


