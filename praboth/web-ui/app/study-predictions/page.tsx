"use client";

import { useEffect, useState } from "react";
import { Surface } from "../components/Surface";
import Heatmap from "./components/Heatmap";
import WeeklyPredictions from "./components/WeeklyPredictions";
import StudyWindow from "./components/StudyWindow";
import styles from "./page.module.css";

interface PredictionData {
  best_time: string;
  percentages: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  status: string;
}

interface HourlyData {
  hour: string;
  intensity: number;
}

interface HourlyResponse {
  hourly_data: HourlyData[];
  status: string;
}

interface StudyWindowPrediction {
  best_window: {
    start_time: string;
    end_time: string;
    time_range: string;
    duration_hours: number;
  };
  confidence: number;
  score: number;
  alternatives: Array<{
    time_range: string;
    score: number;
  }>;
  current_context: {
    current_time: string;
    current_day: string;
    data_points: number;
  };
}

interface DayPrediction {
  best_time: string;
  confidence: number;
  data_points: number;
  all_times?: { [key: string]: number };
}

export default function StudyPredictionsPage() {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [studyWindow, setStudyWindow] = useState<StudyWindowPrediction | null>(null);
  const [weeklyData, setWeeklyData] = useState<{ [day: string]: DayPrediction }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "weekly" | "window">("dashboard");

  // Fetch prediction from backend
  const fetchPrediction = async () => {
    try {
      const response = await fetch("http://localhost:5001/predictall");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data: PredictionData = await response.json();
      setPrediction(data);
    } catch (err) {
      console.error('Error in fetchPrediction:', err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // Fetch hourly intensity data
  const fetchHourlyIntensity = async () => {
    try {
      const response = await fetch("http://localhost:5001/hourly-intensity");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data: HourlyResponse = await response.json();
      setHourlyData(data.hourly_data);
    } catch (err) {
      console.error('Error fetching hourly intensity:', err);
    }
  };

  // Fetch next best study window
  const fetchStudyWindow = async () => {
    try {
      const response = await fetch("http://localhost:5001/next-best-study-window");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      setStudyWindow(data.prediction);
    } catch (err) {
      console.error('Error fetching study window prediction:', err);
    }
  };

  // Fetch weekly predictions
  const fetchWeeklyPredictions = async () => {
    try {
      const response = await fetch("http://localhost:5001/weekly-predictions");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      setWeeklyData(data.weekly_predictions);
    } catch (err) {
      console.error('Error fetching weekly predictions:', err);
    }
  };

  // Auto-fetch when component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchPrediction(),
          fetchHourlyIntensity(),
          fetchWeeklyPredictions(),
          fetchStudyWindow(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <main className={styles.page}>
      <div className={`${styles.container} container-dashboard`}>
        <Surface padding="lg" className="surface">
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Study Time Predictions</p>
              <h1 className={styles.title}>Contextual Bandit Predictions</h1>
              <p className={styles.subhead}>
                AI-powered study time recommendations based on your historical performance patterns.
              </p>
            </div>
          </div>
        </Surface>

        {/* Tab Navigation */}
        <Surface padding="lg" className="surface">
          <div className={styles.tabNavigation}>
            <button
              className={`${styles.tab} ${activeTab === "dashboard" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              📊 Dashboard
            </button>
            <button
              className={`${styles.tab} ${activeTab === "weekly" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("weekly")}
            >
              📅 Weekly Analysis
            </button>
            <button
              className={`${styles.tab} ${activeTab === "window" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("window")}
            >
              ⏱️ Study Window
            </button>
          </div>
        </Surface>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            {isLoading && (
              <Surface padding="lg" className="surface">
                <p className={styles.loadingMessage}>Loading prediction...</p>
              </Surface>
            )}
            {error && (
              <Surface padding="lg" className="surface">
                <p className={styles.errorMessage}>Error: {error}</p>
              </Surface>
            )}
            {prediction && !isLoading && (
              <Surface padding="lg" className="surface">
                <div className={styles.predictionResults}>
                  <div className={styles.bestTimeSection}>
                    <h2 className={styles.bestTimeTitle}>
                      Predicted Best Time: <span className={styles.bestTimeValue}>{prediction.best_time}</span>
                    </h2>
                  </div>
                  
                  <div className={styles.probabilitiesSection}>
                    <h3 className={styles.probabilitiesTitle}>Prediction Probabilities:</h3>
                    <ul className={styles.probabilitiesList}>
                      {Object.entries(prediction.percentages).map(([time, percentage]) => (
                        <li key={time} className={styles.probabilityItem}>
                          <div className={styles.probabilityRow}>
                            <span className={styles.probabilityLabel}>{time}:</span>
                            <div className={styles.probabilityBarContainer}>
                              <div 
                                className={`${styles.probabilityBar} ${time === prediction.best_time ? styles.probabilityBarBest : styles.probabilityBarNormal}`}
                                style={{ width: `${percentage}%` }}
                              >
                                <span className={styles.probabilityValue}>{percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Surface>
            )}
            {prediction && <Heatmap percentages={prediction.percentages} hourlyData={hourlyData} />}
          </>
        )}

        {/* Weekly Tab */}
        {activeTab === "weekly" && (
          <div className={styles.weeklyPageContainer}>
            {isLoading && (
              <Surface padding="lg" className="surface">
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner}></div>
                  <p className={styles.loadingText}>Analyzing your weekly patterns...</p>
                </div>
              </Surface>
            )}
            {error && (
              <Surface padding="lg" className="surface">
                <div className={styles.errorContainer}>
                  <div className={styles.errorIcon}>⚠️</div>
                  <p className={styles.errorMessage}>Error: {error}</p>
                  <button className={styles.retryButton} onClick={() => {
                    setIsLoading(true);
                    fetchWeeklyPredictions().finally(() => setIsLoading(false));
                  }}>
                    Try Again
                  </button>
                </div>
              </Surface>
            )}
            {!isLoading && !error && Object.keys(weeklyData).length > 0 && (
              <WeeklyPredictions weeklyData={weeklyData} />
            )}
          </div>
        )}

        {/* Study Window Tab */}
        {activeTab === "window" && (
          <StudyWindow studyWindow={studyWindow} isLoading={isLoading} error={error} onRetry={fetchStudyWindow} />
        )}
      </div>
    </main>
  );
}

