import { Link } from "react-router-dom";
import "./Navigation.css";

const Navigation = () => {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>Study Bandit</h1>
          <span className="nav-tagline">Smart Study Timing</span>
        </div>
        
        <div className="nav-links">
          <Link to="/" className="nav-link">
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </Link>
          
          <Link to="/weekly" className="nav-link">
            <span className="nav-icon">📅</span>
            <span>Weekly Analysis</span>
          </Link>

          <Link to="/study-window" className="nav-link">
            <span className="nav-icon">⏱️</span>
            <span>Study Window</span>
          </Link>
          
        
          
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
