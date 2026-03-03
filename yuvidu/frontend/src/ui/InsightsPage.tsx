import React from 'react';
import Insights from './components/Insights';
import Navigation from './components/Navigation';
import './page-styles.css';

const InsightsPage: React.FC = () => {
  return (
    <div className="page-container">
      <Navigation />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">📊 Study Insights</h1>
          <p className="page-subtitle">
            Get personalized insights based on your study patterns and productivity trends
          </p>
        </div>
        <Insights />
      </div>
    </div>
  );
};

export default InsightsPage;
