from backend.src.services.processing.features import LogNormalPauseAnalysis
import numpy as np

def check():
    print("Starting manual check...")
    analyzer = LogNormalPauseAnalysis(micro_threshold=2.0, macro_threshold=15.0)
    latencies = [100.0, 500.0, 2000.0, 2500.0, 14900.0, 15000.0, 30000.0]
    # 0.1, 0.5, 2.0, 2.5, 14.9, 15.0, 30.0
    
    stats = analyzer.analyze(latencies)
    print(f"Stats: {stats}")
    
    expected_micro = 3/7 # 0.42857
    expected_macro = 2/7 # 0.28571
    
    print(f"Micro Rate: {stats['micro_pause_rate']} (Expected: {expected_micro})")
    print(f"Macro Rate: {stats['macro_pause_rate']} (Expected: {expected_macro})")
    
    if abs(stats['micro_pause_rate'] - expected_micro) < 0.001:
        print("Micro Rate PASS")
    else:
        print("Micro Rate FAIL")

    if abs(stats['macro_pause_rate'] - expected_macro) < 0.001:
        print("Macro Rate PASS")
    else:
        print("Macro Rate FAIL")

if __name__ == "__main__":
    check()
