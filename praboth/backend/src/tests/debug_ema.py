from backend.src.services.ema import UncertaintySampler
import numpy as np

def debug():
    sampler = UncertaintySampler(history_size=10, percentile=90.0)
    
    # Manually fill
    sampler.variance_history = [0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2]
    print(f"Initial History: {sampler.variance_history}")
    
    # Low variance check
    res_low = sampler.evaluate(0.05)
    print(f"Evaluate(0.05): {res_low}")
    print(f"History after 0.05: {sampler.variance_history}")
    
    # High variance check
    # Before evaluate(1.0), history has 0.05 at end, and lost the first 0.1.
    # Current: [0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.05]
    
    # Calling evaluate(1.0)
    # Will append 1.0
    # Will pop first (0.2)
    # New History: [0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.05, 1.0]
    # Sorted: [0.05, 0.1, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.2, 1.0]
    # 90th percentile (index 8.1):
    # Index 8 is 0.2. Index 9 is 1.0.
    # 0.2 + 0.1 * (0.8) = 0.2 + 0.08 = 0.28.
    # Threshold should be 0.28.
    # 1.0 >= 0.28 -> True.
    
    val = 1.0
    
    # Let's replicate what evaluate does internally for debug
    temp_hist = list(sampler.variance_history)
    temp_hist.append(val)
    if len(temp_hist) > sampler.history_size:
        temp_hist.pop(0)
    
    thresh = np.percentile(temp_hist, 90.0)
    print(f"Debug Threshold for 1.0: {thresh}")
    
    res_high = sampler.evaluate(val)
    print(f"Evaluate(1.0): {res_high}")
    
    if res_high:
        print("PASS")
    else:
        print("FAIL")

if __name__ == "__main__":
    debug()
