"use client";

import { useEffect, useState } from "react";
import WeeklyPredictions, { type DayPrediction } from "@/components/WeeklyPredictions";
import { YUVIDU_API_BASE } from "@/lib/api";
import "./weekly-page.css";

export default function WeeklyPage() {
  const [weeklyData, setWeeklyData] = useState<{ [day: string]: DayPrediction }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklyPredictions = async () => {
    try {
      const response = await fetch(`${YUVIDU_API_BASE}/weekly-predictions`);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setWeeklyData(data.weekly_predictions ?? {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyPredictions();
  }, []);

  return (
    <div className="weekly-page-container">
      <div className="weekly-page-header">
        <h1 className="weekly-page-title">Weekly Study Window Analysis</h1>
        <p className="weekly-page-subtitle">
          Discover your optimal study times for each day of the week based on historical performance data
        </p>
      </div>
      <div className="weekly-page-content">
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing your weekly patterns...</p>
          </div>
        )}
        {error && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-message">Error: {error}</p>
            <button type="button" className="retry-button" onClick={fetchWeeklyPredictions}>
              Try Again
            </button>
          </div>
        )}
        {!isLoading && !error && Object.keys(weeklyData).length > 0 && (
          <WeeklyPredictions weeklyData={weeklyData} />
        )}
      </div>
    </div>
  );
}
