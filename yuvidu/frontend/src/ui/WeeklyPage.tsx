import { useEffect, useState } from "react";
import WeeklyPredictions from "./components/WeeklyPredictions";
import { apiUrl } from "../config";
import "./WeeklyPage.css";

interface DayPrediction {
  best_time: string;
  confidence: number;
  data_points: number;
  all_times?: { [key: string]: number };
}

function WeeklyPage() {
  const [weeklyData, setWeeklyData] = useState<{ [day: string]: DayPrediction }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch weekly predictions
  const fetchWeeklyPredictions = async () => {
    try {
      const response = await fetch(apiUrl("weekly-predictions"));
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      setWeeklyData(data.weekly_predictions);
    } catch (err) {
      console.error('Error fetching weekly predictions:', err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when component mounts
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
            <div className="loading-spinner"></div>
            <p className="loading-text">Analyzing your weekly patterns...</p>
          </div>
        )}
        
        {error && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-message">Error: {error}</p>
            <button className="retry-button" onClick={fetchWeeklyPredictions}>
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

export default WeeklyPage;
