import React from 'react';

interface ConsentEntry {
  timestamp: string;
  granted: boolean;
  reason?: string | null;
}

interface ConsentSettingProps {
  granted: boolean;
  onToggle: (granted: boolean) => void;
  history?: ConsentEntry[];
  loading?: boolean;
  disabled?: boolean;
}

export function ConsentSetting({
  granted,
  onToggle,
  history = [],
  loading = false,
  disabled = false,
}: ConsentSettingProps) {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="consent-setting">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-fluid-sm font-semibold text-primary">Consent Management</h3>
          <p className="text-fluid-xs text-secondary">
            Manage your consent for data collection and processing
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!granted)}
          disabled={disabled || loading}
          className={`rounded-full px-5 py-2 text-fluid-sm font-semibold text-white transition disabled:opacity-50 focus-ring ${
            granted
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {loading ? 'Loading...' : granted ? 'Consent Granted' : 'Consent Revoked'}
        </button>
      </div>

      <div className="mt-4 text-fluid-xs text-muted space-y-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${granted ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span>Current status: {granted ? 'Granted' : 'Revoked'}</span>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <h4 className="text-fluid-xs font-semibold text-primary mb-3">Consent History</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.slice().reverse().map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="flex items-start gap-3 p-2 rounded-lg bg-slate-900/30 border border-slate-700/40"
              >
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    entry.granted ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-fluid-xs text-secondary">
                      {entry.granted ? 'Granted' : 'Revoked'}
                    </span>
                    <span className="text-fluid-xs text-muted">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  {entry.reason && (
                    <p className="mt-1 text-fluid-xs text-muted truncate">{entry.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
