import React, { useState, useEffect } from 'react';
import './Insights.css';

interface InsightsData {
  status: string;
  insights: string[];
  message?: string;
}

interface InsightsProps {
  className?: string;
}

const Insights: React.FC<InsightsProps> = ({ className = '' }) => {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("http://localhost:5001/insights");
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data: InsightsData = await response.json();
      setInsights(data);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err.message : "Failed to fetch insights");
    } finally {
      setIsLoading(false);
    }
  };

  const getInsightIcon = (insight: string) => {
    if (insight.includes('more productive')) return '📈';
    if (insight.includes('less productive')) return '📉';
    if (insight.includes('best study day')) return '🌟';
    if (insight.includes('higher rewards')) return '⚡';
    if (insight.includes('focus levels')) return '🎯';
    if (insight.includes('consistent')) return '⚖️';
    return '💡';
  };

  const getInsightType = (insight: string) => {
    if (insight.includes('more productive')) return 'positive';
    if (insight.includes('less productive')) return 'negative';
    if (insight.includes('best study day')) return 'success';
    if (insight.includes('higher rewards')) return 'success';
    if (insight.includes('focus levels')) return 'focus';
    return 'neutral';
  };

  if (isLoading) {
    return (
      <div className={`insights-container ${className}`}>
        <div className="insights-header">
          <h2 className="insights-title">📊 Weekly Insights</h2>
        </div>
        <div className="insights-loading">
          <div className="loading-spinner"></div>
          <p>Analyzing your study patterns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`insights-container ${className}`}>
        <div className="insights-header">
          <h2 className="insights-title">📊 Weekly Insights</h2>
        </div>
        <div className="insights-error">
          <p>❌ {error}</p>
          <button onClick={fetchInsights} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!insights || insights.status !== 'success' || !insights.insights.length) {
    return (
      <div className={`insights-container ${className}`}>
        <div className="insights-header">
          <h2 className="insights-title">📊 Weekly Insights</h2>
        </div>
        <div className="insights-empty">
          <p>No insights available at the moment.</p>
          <p>Keep studying to generate personalized insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`insights-container ${className}`}>
      <div className="insights-header">
        <h2 className="insights-title">📊 Weekly Insights</h2>
        <button onClick={fetchInsights} className="refresh-button" title="Refresh insights">
          🔄
        </button>
      </div>
      
      <div className="insights-content">
        {insights.insights.map((insight, index) => {
          const icon = getInsightIcon(insight);
          const type = getInsightType(insight);
          
          return (
            <div 
              key={index} 
              className={`insight-card insight-${type}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="insight-icon">{icon}</div>
              <div className="insight-text">{insight}</div>
            </div>
          );
        })}
      </div>
      
      <div className="insights-footer">
        <p className="insights-disclaimer">
          💡 Insights are generated from your recent study patterns and may update weekly.
        </p>
      </div>
    </div>
  );
};

export default Insights;
