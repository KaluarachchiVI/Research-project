"use client";

import { Surface } from "../../components/Surface";
import styles from "./StudyWindow.module.css";

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

interface StudyWindowProps {
  studyWindow: StudyWindowPrediction | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function StudyWindow({ studyWindow, isLoading, error, onRetry }: StudyWindowProps) {
  return (
    <>
      {/* Loading State */}
      {isLoading && (
        <Surface padding="lg" className="surface">
          <div className={styles.loadingState}>
            <p>Loading study window prediction...</p>
          </div>
        </Surface>
      )}
      
      {/* Error State */}
      {error && (
        <Surface padding="lg" className="surface">
          <div className={styles.errorState}>
            <p>Error: {error}</p>
            <button className={styles.retryButton} onClick={onRetry}>
              Try Again
            </button>
          </div>
        </Surface>
      )}
      
      {/* Next Best Study Window Section */}
      {studyWindow && !isLoading && (
        <Surface padding="lg" className="surface">
          <div className={styles.section}>
            <h2 className={styles.title}>Next Best 4-Hour Study Window</h2>
            <div className={styles.card}>
              <div className={styles.main}>
                <div className={styles.time}>
                  <h3>{studyWindow.best_window.time_range}</h3>
                  <p className={styles.duration}>Duration: {studyWindow.best_window.duration_hours} hours</p>
                </div>
                <div className={styles.details}>
                  <p><strong>Start:</strong> {studyWindow.best_window.start_time}</p>
                  <p><strong>End:</strong> {studyWindow.best_window.end_time}</p>
                  <p><strong>Confidence:</strong> {(studyWindow.confidence * 100).toFixed(1)}%</p>
                  <p><strong>Score:</strong> {studyWindow.score.toFixed(3)}</p>
                </div>
              </div>
              
              <div className={styles.alternatives}>
                <h4>Alternative Time Windows:</h4>
                <ul className={styles.alternativesList}>
                  {studyWindow.alternatives.map((alt, index) => (
                    <li key={index} className={styles.alternativeItem}>
                      <span className={styles.alternativeTime}>{alt.time_range}</span>
                      <span className={styles.alternativeScore}>Score: {alt.score.toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className={styles.context}>
                <p><small>Based on {studyWindow.current_context.data_points} historical sessions</small></p>
                <p><small>Current time: {studyWindow.current_context.current_time}</small></p>
                <p><small>Day: {studyWindow.current_context.current_day}</small></p>
              </div>
            </div>
          </div>
        </Surface>
      )}
    </>
  );
}

export default StudyWindow;

