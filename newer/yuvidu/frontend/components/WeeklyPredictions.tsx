"use client";

import React from "react";
import "./WeeklyPredictions.css";

export interface DayPrediction {
  best_time: string;
  confidence: number;
  data_points: number;
  all_times?: { [key: string]: number };
}

interface WeeklyPredictionsProps {
  weeklyData: { [day: string]: DayPrediction };
}

export default function WeeklyPredictions({ weeklyData }: WeeklyPredictionsProps) {
  const getTimeIcon = (time: string) => {
    switch (time) {
      case "morning": return "🌅";
      case "afternoon": return "☀️";
      case "evening": return "🌆";
      case "night": return "🌙";
      default: return "📚";
    }
  };

  const getTimeColor = (time: string) => {
    switch (time) {
      case "morning": return "#FFB74D";
      case "afternoon": return "#4FC3F7";
      case "evening": return "#BA68C8";
      case "night": return "#5C6BC0";
      default: return "#78909C";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "#4CAF50";
    if (confidence >= 0.5) return "#FFC107";
    return "#F44336";
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="weekly-predictions-container">
      <h2 className="weekly-title">Weekly Study Window Predictions</h2>
      <div className="weekly-grid">
        {days.map((day) => {
          const prediction = weeklyData[day];
          if (!prediction) return null;
          return (
            <div key={day} className="day-card">
              <div className="day-header">
                <h3 className="day-name">{day}</h3>
                <div className="data-points">{prediction.data_points} sessions</div>
              </div>
              <div className="prediction-content">
                <div className="best-time-display">
                  <span className="time-icon">{getTimeIcon(prediction.best_time)}</span>
                  <span className="time-label" style={{ color: getTimeColor(prediction.best_time) }}>
                    {prediction.best_time.charAt(0).toUpperCase() + prediction.best_time.slice(1)}
                  </span>
                </div>
                <div className="confidence-meter">
                  <span className="confidence-label">Confidence:</span>
                  <div className="confidence-bar-container">
                    <div
                      className="confidence-bar"
                      style={{
                        width: `${prediction.confidence * 100}%`,
                        backgroundColor: getConfidenceColor(prediction.confidence),
                      }}
                    />
                  </div>
                  <span className="confidence-value">{(prediction.confidence * 100).toFixed(0)}%</span>
                </div>
                {prediction.all_times && (
                  <div className="all-times-breakdown">
                    {Object.entries(prediction.all_times).map(([time, reward]) => (
                      <div key={time} className="time-breakdown-item">
                        <span className="breakdown-time">{time}:</span>
                        <div className="breakdown-bar-container">
                          <div
                            className="breakdown-bar"
                            style={{
                              width: `${(reward / Math.max(...Object.values(prediction.all_times!))) * 100}%`,
                              backgroundColor: getTimeColor(time),
                            }}
                          />
                        </div>
                        <span className="breakdown-value">{reward.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="weekly-summary">
        <h3>Weekly Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Most Productive Time</h4>
            <p>
              {(() => {
                const timeCounts: { [key: string]: number } = {};
                days.forEach((day) => {
                  const time = weeklyData[day]?.best_time;
                  if (time) timeCounts[time] = (timeCounts[time] || 0) + 1;
                });
                const mostCommon = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0];
                return mostCommon ? `${mostCommon[0]} (${mostCommon[1]} days)` : "No data";
              })()}
            </p>
          </div>
          <div className="insight-card">
            <h4>Average Confidence</h4>
            <p>
              {(
                (days.reduce((sum, day) => sum + (weeklyData[day]?.confidence || 0), 0) / days.length) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
          <div className="insight-card">
            <h4>Total Sessions Analyzed</h4>
            <p>{days.reduce((sum, day) => sum + (weeklyData[day]?.data_points || 0), 0)} sessions</p>
          </div>
        </div>
      </div>
    </div>
  );
}
