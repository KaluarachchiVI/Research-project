"use client";

import React from "react";
import { Surface } from "../../components/Surface";
import styles from "./WeeklyPredictions.module.css";

interface DayPrediction {
  best_time: string;
  confidence: number;
  data_points: number;
  all_times?: { [key: string]: number };
}

interface WeeklyPredictionsProps {
  weeklyData: { [day: string]: DayPrediction };
}

const WeeklyPredictions: React.FC<WeeklyPredictionsProps> = ({ weeklyData }) => {
  const getTimeIcon = (time: string) => {
    switch (time) {
      case 'morning': return '🌅';
      case 'afternoon': return '☀️';
      case 'evening': return '🌆';
      case 'night': return '🌙';
      default: return '📚';
    }
  };

  const getTimeColor = (time: string) => {
    switch (time) {
      case 'morning': return '#FFB74D';
      case 'afternoon': return '#4FC3F7';
      case 'evening': return '#BA68C8';
      case 'night': return '#5C6BC0';
      default: return '#78909C';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return '#4CAF50';
    if (confidence >= 0.5) return '#FFC107';
    return '#F44336';
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <>
      <Surface padding="lg" className="surface">
        <h2 className={styles.title}>Weekly Study Window Predictions</h2>
        <div className={styles.grid}>
          {days.map(day => {
            const prediction = weeklyData[day];
            if (!prediction) return null;

            return (
              <div key={day} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <h3 className={styles.dayName}>{day}</h3>
                  <div className={styles.dataPoints}>{prediction.data_points} sessions</div>
                </div>
                
                <div className={styles.predictionContent}>
                  <div className={styles.bestTimeDisplay}>
                    <span className={styles.timeIcon}>{getTimeIcon(prediction.best_time)}</span>
                    <span 
                      className={styles.timeLabel}
                      style={{ color: getTimeColor(prediction.best_time) }}
                    >
                      {prediction.best_time.charAt(0).toUpperCase() + prediction.best_time.slice(1)}
                    </span>
                  </div>
                  
                  <div className={styles.confidenceMeter}>
                    <span className={styles.confidenceLabel}>Confidence:</span>
                    <div className={styles.confidenceBarContainer}>
                      <div 
                        className={styles.confidenceBar}
                        style={{ 
                          width: `${prediction.confidence * 100}%`,
                          backgroundColor: getConfidenceColor(prediction.confidence)
                        }}
                      />
                    </div>
                    <span className={styles.confidenceValue}>
                      {(prediction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {prediction.all_times && (
                    <div className={styles.allTimesBreakdown}>
                      {Object.entries(prediction.all_times).map(([time, reward]) => (
                        <div key={time} className={styles.timeBreakdownItem}>
                          <span className={styles.breakdownTime}>{time}:</span>
                          <div className={styles.breakdownBarContainer}>
                            <div 
                              className={styles.breakdownBar}
                              style={{ 
                                width: `${(reward / Math.max(...Object.values(prediction.all_times!))) * 100}%`,
                                backgroundColor: getTimeColor(time)
                              }}
                            />
                          </div>
                          <span className={styles.breakdownValue}>{reward.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Surface>
      
      <Surface padding="lg" className="surface">
        <div className={styles.summary}>
          <h3>Weekly Insights</h3>
          <div className={styles.insightsGrid}>
            <div className={styles.insightCard}>
              <h4>Most Productive Time</h4>
              <p>
                {(() => {
                  const timeCounts: { [key: string]: number } = {};
                  days.forEach(day => {
                    const time = weeklyData[day]?.best_time;
                    if (time) timeCounts[time] = (timeCounts[time] || 0) + 1;
                  });
                  const mostCommon = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0];
                  return mostCommon ? `${mostCommon[0]} (${mostCommon[1]} days)` : 'No data';
                })()}
              </p>
            </div>
            
            <div className={styles.insightCard}>
              <h4>Average Confidence</h4>
              <p>
                {(
                  days.reduce((sum, day) => sum + (weeklyData[day]?.confidence || 0), 0) / 
                  days.length * 100
                ).toFixed(1)}%
              </p>
            </div>
            
            <div className={styles.insightCard}>
              <h4>Total Sessions Analyzed</h4>
              <p>
                {days.reduce((sum, day) => sum + (weeklyData[day]?.data_points || 0), 0)} sessions
              </p>
            </div>
          </div>
        </div>
      </Surface>
    </>
  );
};

export default WeeklyPredictions;

