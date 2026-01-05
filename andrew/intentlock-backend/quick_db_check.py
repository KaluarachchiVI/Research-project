"""
Quick Database Check - Simple queries for common verification needs

Usage:
    python quick_db_check.py [option]

Options:
    schema      - Show database schema
    training    - Show training data summary
    events      - Show recent exit events
    accuracy    - Check model accuracy
    all         - Run all checks (default)
"""

import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def show_schema():
    """Quick schema check"""
    from data.database import get_connection
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print("\n📋 Database Tables:")
    for (table,) in tables:
        if table != 'sqlite_sequence':
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  - {table}: {count} rows")
    
    conn.close()

def show_training_summary():
    """Quick training data summary"""
    from data.database import get_connection
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM synthetic_training_data")
    total = cursor.fetchone()[0]
    
    if total == 0:
        print("\n⚠️  No training data found!")
        return
    
    cursor.execute("""
        SELECT 
            label,
            COUNT(*) as count
        FROM synthetic_training_data
        GROUP BY label
    """)
    
    print(f"\n📊 Training Data: {total} samples")
    for label, count in cursor.fetchall():
        label_name = "Impulsive" if label == 1 else "Genuine"
        print(f"  {label_name}: {count} ({count/total*100:.1f}%)")
    
    conn.close()

def show_recent_events():
    """Show recent exit events"""
    from data.database import get_connection
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            timestamp,
            prediction,
            friction_level,
            session_minutes,
            latent_mean
        FROM exit_events
        ORDER BY timestamp DESC
        LIMIT 5
    """)
    
    events = cursor.fetchall()
    
    if not events:
        print("\n📝 No exit events yet")
        return
    
    print("\n📝 Recent Exit Events (last 5):")
    print(f"{'Time':<20} {'Prediction':<12} {'Friction':<10} {'Session':<10} {'Load':<8}")
    print("-" * 70)
    
    for ts, pred, friction, sess, load in events:
        time_str = ts[:19] if len(ts) > 19 else ts
        print(f"{time_str:<20} {pred:<12} {friction:<10} {sess:<10.1f} {load:<8.3f}")
    
    conn.close()

def check_accuracy():
    """Quick accuracy check"""
    try:
        from models.model import IntentModel
        from data.database import get_training_data
        
        model = IntentModel()
        training_data = get_training_data()
        
        if len(training_data) == 0:
            print("\n⚠️  No training data to check")
            return
        
        correct = sum(1 for sess, load, label in training_data 
                     if model.predict(sess, load) == label)
        accuracy = (correct / len(training_data)) * 100
        
        print(f"\n🎯 Model Accuracy: {accuracy:.1f}% ({correct}/{len(training_data)})")
        
        if accuracy >= 70:
            print("   ✅ Accuracy is good")
        elif accuracy >= 60:
            print("   ⚠️  Accuracy is moderate")
        else:
            print("   ❌ Accuracy is low - consider retraining")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

def main():
    """Main function"""
    option = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    print("\n" + "="*70)
    print("  QUICK DATABASE CHECK")
    print("="*70)
    
    if option == "schema" or option == "all":
        show_schema()
    
    if option == "training" or option == "all":
        show_training_summary()
    
    if option == "events" or option == "all":
        show_recent_events()
    
    if option == "accuracy" or option == "all":
        check_accuracy()
    
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    main()

