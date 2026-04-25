"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Heatmap from "@/components/Heatmap";
import { YUVIDU_API_BASE } from "@/lib/api";

interface PredictionData {
  best_time: string;
  percentages: { morning: number; afternoon: number; evening: number; night: number };
  status: string;
}

interface HourlyData {
  hour: string;
  intensity: number;
  value?: number;
}

interface HourlyResponse {
  hourly_data: HourlyData[];
  status: string;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id") ?? undefined;
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${YUVIDU_API_BASE}/predictall`);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data: PredictionData = await response.json();
      setPrediction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHourlyIntensity = async () => {
    try {
      const url = userId
        ? `${YUVIDU_API_BASE}/hourly-intensity?user_id=${encodeURIComponent(userId)}`
        : `${YUVIDU_API_BASE}/hourly-intensity`;
      const response = await fetch(url);
      if (!response.ok) return;
      const data: HourlyResponse = await response.json();
      setHourlyData(data.hourly_data ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPrediction();
    fetchHourlyIntensity();
  }, [userId]);

  return (
    <div className="app-container">
      <h1 className="app-title">Contextual Bandit Prediction</h1>
      <div className="prediction-form">
        {isLoading && <p className="loading-message">Loading prediction...</p>}
        {error && <p className="error-message">Error: {error}</p>}

        {prediction && !isLoading && (
          <div className="prediction-results">
            <div className="best-time-section">
              <h2 className="best-time-title">
                Predicted Best Time: <span className="best-time-value">{prediction.best_time}</span>
              </h2>
            </div>
            <div className="probabilities-section">
              <h3 className="probabilities-title">Prediction Probabilities:</h3>
              <ul className="probabilities-list">
                {Object.entries(prediction.percentages).map(([time, percentage]) => (
                  <li key={time} className="probability-item">
                    <div className="probability-row">
                      <span className="probability-label">{time}:</span>
                      <div className="probability-bar-container">
                        <div
                          className={`probability-bar ${time === prediction.best_time ? "probability-bar-best" : "probability-bar-normal"}`}
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="probability-value">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {prediction && <Heatmap percentages={prediction.percentages} hourlyData={hourlyData} />}
      </div>
    </div>
  );
}
