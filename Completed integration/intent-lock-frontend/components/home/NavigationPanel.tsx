"use client";

import Link from "next/link";
import { Terminal, Sliders, Layout, ShieldCheck } from "lucide-react";

export function NavigationPanel() {
  return (
    <div className="navigation-panel">
      <NavItem
        href="/console"
        icon={<Terminal size={18} />}
        title="Telemetry Console"
        subtitle="Raw metrics & logs"
        primary
      />
      <NavItem
        href="/settings"
        icon={<Sliders size={18} />}
        title="Policy Settings"
        subtitle="Guard rails & rules"
      />
          <NavItem
            href="/advanced"
            icon={<Layout size={18} />}
            title="Advanced Details"
            subtitle="Runtime snapshot & context"
          />
    </div>
  );
}

function NavItem({
  href,
  icon,
  title,
  subtitle,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`navigation-panel__item ${primary ? "navigation-panel__item--primary" : ""}`}
    >
      <div className="navigation-panel__icon-wrapper">{icon}</div>
      <div className="navigation-panel__content">
        <div className="navigation-panel__item-title">{title}</div>
        <div className="navigation-panel__item-subtitle">{subtitle}</div>
      </div>
    </Link>
  );
}
