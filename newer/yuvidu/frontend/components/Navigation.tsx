import Link from "next/link";
import "./Navigation.css";

export default function Navigation() {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>Study Bandit</h1>
          <span className="nav-tagline">Smart Study Timing</span>
        </div>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/weekly" className="nav-link">
            <span className="nav-icon">📅</span>
            <span>Weekly Analysis</span>
          </Link>
          <Link href="/study-window" className="nav-link">
            <span className="nav-icon">⏱️</span>
            <span>Study Window</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
