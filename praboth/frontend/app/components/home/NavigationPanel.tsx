"use client";

import Link from "next/link";
import styles from "./NavigationPanel.module.css";
import { Terminal, Sliders, Layout, ShieldCheck } from "lucide-react";

export function NavigationPanel() {
  return (
    <div className={styles.navGrid}>
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
    </div>
  );
}

function NavItem({ href, icon, title, subtitle, primary = false }: { href: string, icon: React.ReactNode, title: string, subtitle: string, primary?: boolean }) {
    return (
        <Link href={href} className={`${styles.navItem} ${primary ? styles.primary : ""}`}>
            <div className={styles.iconWrapper}>
                {icon}
            </div>
            <div className={styles.content}>
                <div className={styles.itemTitle}>{title}</div>
                <div className={styles.itemSubtitle}>{subtitle}</div>
            </div>
        </Link>
    );
}
