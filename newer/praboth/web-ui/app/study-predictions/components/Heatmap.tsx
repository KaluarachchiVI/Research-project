"use client";

import React from "react";
import { scaleLinear } from "d3-scale";
import { Surface } from "../../components/Surface";
import styles from "./Heatmap.module.css";

interface HeatmapProps {
  percentages: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  hourlyData?: {
    hour: string;
    intensity: number;
    value?: number;
  }[];
}

const Heatmap: React.FC<HeatmapProps> = ({ percentages, hourlyData }) => {
  // Create hourly data for better heatmap visualization
  const hours = [
    "6AM", "7AM", "8AM", "9AM", "10AM", "11AM",
    "12PM", "1PM", "2PM", "3PM", "4PM", "5PM",
    "6PM", "7PM", "8PM", "9PM", "10PM", "11PM",
    "12AM", "1AM", "2AM", "3AM", "4AM", "5AM"
  ];

  // Use real hourly data if available, otherwise fall back to distributed percentages
  const hourlyDataForDisplay = hourlyData && hourlyData.length > 0 
    ? hourlyData 
    : hours.map((hour, index) => {
        let value;
        if (index < 6) { // Morning (6AM-11AM)
          value = percentages?.morning ?? 0;
        } else if (index < 12) { // Afternoon (12PM-5PM)
          value = percentages?.afternoon ?? 0;
        } else if (index < 18) { // Evening (6PM-11PM)
          value = percentages?.evening ?? 0;
        } else { // Night (12AM-5AM)
          value = percentages?.night ?? 0;
        }
        return { hour, value };
      });

  // Better heatmap color scale - more distinct colors for intensity
  const colorScale = scaleLinear<string>()
    .domain([0, 20, 40, 60, 80, 100])
    .range([
      "#dc2626", // Dark red for very low
      "#f87171", // Light red for low  
      "#fbbf24", // Amber for medium-low
      "#facc15", // Yellow for medium
      "#84cc16", // Lime for medium-high
      "#16a34a"  // Green for high
    ]);

  return (
    <Surface padding="lg" className="surface">
      <div className={styles.container}>
        <h3 className={styles.title}>
          🌡️ Prediction Intensity Heatmap
        </h3>

        {/* Traditional heatmap grid */}
        <div className={styles.gridSection}>
          {/* Time period labels */}
          <div className={styles.periodLabels}>
            <div></div>
            <div className={styles.periodLabel} style={{ gridColumn: "2/8" }}>Morning</div>
            <div className={styles.periodLabel} style={{ gridColumn: "8/14" }}>Afternoon</div>
            <div className={styles.periodLabel} style={{ gridColumn: "14/20" }}>Evening</div>
            <div className={styles.periodLabel} style={{ gridColumn: "20/26" }}>Night</div>
          </div>

          {/* Hour labels */}
          <div className={styles.hourLabels}>
            <div>Time</div>
            {hours.map(hour => (
              <div key={hour} className={styles.hourLabel}>{hour}</div>
            ))}
          </div>

          {/* Heatmap cells */}
          <div className={styles.cells}>
            <div className={styles.intensityLabel}>Intensity</div>
            {hourlyDataForDisplay.map((data, index) => {
              const intensity = 'intensity' in data ? data.intensity : data.value || 0;
              const color = colorScale(intensity);
              // Better text contrast based on background color
              const textColor = intensity >= 60 ? styles.textLight : intensity >= 40 ? styles.textMedium : styles.textDark;
              
              return (
                <div
                  key={index}
                  className={styles.cell}
                  style={{ background: color }}
                  title={`${data.hour}: ${intensity.toFixed(1)}% intensity`}
                >
                  <div className={styles.cellContent}>
                    <div className={styles.cellHour}>
                      {data.hour}
                    </div>
                    <div className={`${styles.cellPercentage} ${textColor}`}>
                      {intensity.toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary statistics */}
        <div className={styles.summary}>
          <div className={`${styles.summaryCard} ${styles.summaryMorning}`}>
            <div className={styles.summaryLabel}>Morning</div>
            <div className={styles.summaryValue}>
              {(percentages?.morning ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryAfternoon}`}>
            <div className={styles.summaryLabel}>Afternoon</div>
            <div className={styles.summaryValue}>
              {(percentages?.afternoon ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryEvening}`}>
            <div className={styles.summaryLabel}>Evening</div>
            <div className={styles.summaryValue}>
              {(percentages?.evening ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryEvening}`}>
            <div className={styles.summaryLabel}>Night</div>
            <div className={styles.summaryValue}>
              {(percentages?.night ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Color scale legend */}
        <div className={styles.legend}>
          <div className={styles.legendTitle}>
            Intensity Scale (Low → High)
          </div>
          <div className={styles.legendContainer}>
            <span className={styles.legendLabel}>0%</span>
            <div className={styles.legendBar}>
              {[0, 20, 40, 60, 80, 100].map((val, idx) => {
                const textColor = val >= 60 ? styles.legendSegmentLightText : styles.legendSegmentDarkText;
                return (
                  <div
                    key={idx}
                    className={`${styles.legendSegment} ${textColor}`}
                    style={{ background: colorScale(val) }}
                  >
                    {val}%
                  </div>
                );
              })}
            </div>
            <span className={styles.legendLabel}>100%</span>
          </div>
          <div className={styles.legendScale}>
            <span className={styles.legendScaleLabel}>Very Low</span>
            <span className={styles.legendScaleLabel}>Low</span>
            <span className={styles.legendScaleLabel}>Medium</span>
            <span className={styles.legendScaleLabel}>High</span>
            <span className={styles.legendScaleLabel}>Very High</span>
          </div>
        </div>
      </div>
    </Surface>
  );
};

export default Heatmap;

