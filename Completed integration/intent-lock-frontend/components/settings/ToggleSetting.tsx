import React from 'react';

interface ToggleSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
}

export function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  loading = false,
  variant = 'primary',
}: ToggleSettingProps) {
  const variantStyles = {
    primary: 'bg-cyan-600 hover:bg-cyan-500',
    secondary: 'bg-indigo-600 hover:bg-indigo-500',
    success: 'bg-emerald-600 hover:bg-emerald-500',
    danger: 'bg-rose-600 hover:bg-rose-500',
  };

  const handleToggle = () => {
    if (!disabled && !loading) {
      onChange(!checked);
    }
  };

  return (
    <div className="toggle-setting">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-fluid-sm font-semibold text-primary">{label}</label>
          {description && (
            <p className="mt-1 text-fluid-xs text-secondary">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || loading}
          className={`rounded-full px-5 py-2 text-fluid-sm font-semibold text-white transition disabled:opacity-50 focus-ring ${variantStyles[variant]}`}
        >
          {loading ? 'Loading...' : checked ? 'Enabled' : 'Disabled'}
        </button>
      </div>
    </div>
  );
}
