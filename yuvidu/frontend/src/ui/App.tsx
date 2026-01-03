import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Heatmap from "./components/Heatmap";
import Navigation from "./components/Navigation";
import WeeklyPage from "./WeeklyPage";
import "./AppStyles.css";

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

function App() {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [studyWindow, setStudyWindow] = useState<StudyWindowPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Main dashboard component
  const Dashboard = () => (
    <>
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
                          className={`probability-bar ${time === prediction.best_time ? 'probability-bar-best' : 'probability-bar-normal'}`}
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
        
        {/* Next Best Study Window Section */}
        {studyWindow && !isLoading && (
          <div className="study-window-section">
            <h2 className="study-window-title">Next Best 4-Hour Study Window</h2>
            <div className="study-window-card">
              <div className="study-window-main">
                <div className="study-window-time">
                  <h3>{studyWindow.best_window.time_range}</h3>
                  <p className="study-window-duration">Duration: {studyWindow.best_window.duration_hours} hours</p>
                </div>
                <div className="study-window-details">
                  <p><strong>Start:</strong> {studyWindow.best_window.start_time}</p>
                  <p><strong>End:</strong> {studyWindow.best_window.end_time}</p>
                  <p><strong>Confidence:</strong> {(studyWindow.confidence * 100).toFixed(1)}%</p>
                  <p><strong>Score:</strong> {studyWindow.score.toFixed(3)}</p>
                </div>
              </div>
              
              <div className="study-window-alternatives">
                <h4>Alternative Time Windows:</h4>
                <ul className="alternatives-list">
                  {studyWindow.alternatives.map((alt, index) => (
                    <li key={index} className="alternative-item">
                      <span className="alternative-time">{alt.time_range}</span>
                      <span className="alternative-score">Score: {alt.score.toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="study-window-context">
                <p><small>Based on {studyWindow.current_context.data_points} historical sessions</small></p>
                <p><small>Current time: {studyWindow.current_context.current_time}</small></p>
                <p><small>Day: {studyWindow.current_context.current_day}</small></p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );

  // Fetch prediction from backend
  const fetchPrediction = async () => {
    console.log('Starting to fetch prediction...');
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:5001/predictall");
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data: PredictionData = await response.json();
      console.log('Received data:', data);
      setPrediction(data);
    } catch (err) {
      console.error('Error in fetchPrediction:', err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      console.log('Finished loading');
      setIsLoading(false);
    }
  };

  // Fetch weekly predictions
  const fetchWeeklyPredictions = async () => {
    try {
      const response = await fetch("http://localhost:5001/weekly-predictions");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      await response.json(); // Just ensure the endpoint works
    } catch (err) {
      console.error('Error fetching weekly predictions:', err);
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

  // Auto-fetch when component mounts
  useEffect(() => {
    fetchPrediction();
    fetchHourlyIntensity();
    fetchWeeklyPredictions();
    fetchStudyWindow();
  }, []);

  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/weekly" element={<WeeklyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
