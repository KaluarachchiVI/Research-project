import React from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  status?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className = '',
  status,
}: SettingsSectionProps) {
  return (
    <section className={`settings-section surface ${className}`}>
      <div className="section-header">
        <div>
          <h2 className="text-fluid-xl font-bold text-primary">{title}</h2>
          {description && (
            <p className="mt-2 text-fluid-base text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {status && <span className="text-fluid-xs text-muted">{status}</span>}
      </div>
      {children}
    </section>
  );
}
