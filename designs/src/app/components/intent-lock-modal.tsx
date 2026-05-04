import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface IntentLockModalProps {
  isOpen: boolean;
  frictionLevel: 0 | 1 | 2;
  onContinue: () => void;
  onExit: (reason?: string) => void;
}

export function IntentLockModal({
  isOpen,
  frictionLevel,
  onContinue,
  onExit,
}: IntentLockModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      onExit(selectedReason || reasonText);
    }
  }, [showCountdown, countdown, selectedReason, reasonText, onExit]);

  if (!isOpen) return null;

  const handleFriction2Exit = () => {
    setShowCountdown(true);
  };

  const handleCancel = () => {
    setShowCountdown(false);
    setCountdown(3);
    onContinue();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-[1.25rem] p-8 max-w-lg w-full shadow-2xl">
        <div className="mb-6">
          <h2 className="mb-2">Intent-Lock</h2>
          <p className="text-sm text-muted-foreground">
            Our system detected this exit may be impulsive. Please confirm your intention.
          </p>
        </div>

        {frictionLevel === 0 && (
          <div className="space-y-3">
            <button
              onClick={onContinue}
              className="w-full px-6 py-4 rounded-full transition-opacity border"
              style={{ 
                backgroundColor: 'rgba(186, 212, 170, 0.2)',
                borderColor: 'rgba(186, 212, 170, 0.4)',
                color: '#BAD4AA'
              }}
            >
              Continue Studying
            </button>
            <button
              onClick={() => onExit()}
              className="w-full px-6 py-4 rounded-full transition-colors border"
              style={{ 
                backgroundColor: 'rgba(239, 100, 97, 0.15)',
                borderColor: 'rgba(239, 100, 97, 0.4)',
                color: '#EF6461'
              }}
            >
              Exit Anyway
            </button>
          </div>
        )}

        {frictionLevel === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Select a reason
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              >
                <option value="">Choose a reason...</option>
                <option value="distracted">Feeling distracted</option>
                <option value="tired">Too tired to continue</option>
                <option value="completed">Task completed</option>
                <option value="break">Need a longer break</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Additional notes (optional)
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                className="w-full px-4 py-3 bg-input-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground resize-none"
                rows={3}
                placeholder="Provide additional details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={onContinue}
                className="px-6 py-3 bg-secondary border border-border rounded-full hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onExit(selectedReason || reasonText)}
                className="px-6 py-3 bg-destructive/20 text-destructive border border-destructive/30 rounded-full hover:bg-destructive/30 transition-colors"
              >
                Save & Exit
              </button>
            </div>
          </div>
        )}

        {frictionLevel === 2 && (
          <div className="space-y-4">
            {!showCountdown ? (
              <>
                <p className="text-center text-foreground mb-4">
                  Are you sure you want to exit your session?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onContinue}
                    className="px-6 py-3 bg-secondary border border-border rounded-full hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFriction2Exit}
                    className="px-6 py-3 bg-destructive/20 text-destructive border border-destructive/30 rounded-full hover:bg-destructive/30 transition-colors"
                  >
                    Confirm Exit
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-6">
                <div className="text-6xl font-mono text-destructive">{countdown}</div>
                <p className="text-muted-foreground">
                  Exiting in {countdown} second{countdown !== 1 ? 's' : ''}...
                </p>
                <button
                  onClick={handleCancel}
                  className="px-8 py-3 bg-secondary border border-border rounded-full hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}