import { useState, useEffect } from 'react'
import './components/StudyWindow.css'


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

function StudyWindow() {
  const [studyWindow, setStudyWindow] = useState<StudyWindowPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch next best study window
  const fetchStudyWindow = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:5001/next-best-study-window");
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      setStudyWindow(data.prediction);
      setError(null);
    } catch (err) {
      console.error('Error fetching study window prediction:', err);
      setError('Failed to fetch study window prediction');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when component mounts
  useEffect(() => {
    fetchStudyWindow();
  }, []);
    
  return (
    <div className='studywindowmain'>
         {/* Loading State */}
         {isLoading && (
           <div className="loading-state">
             <p>Loading study window prediction...</p>
           </div>
         )}
         
         {/* Error State */}
         {error && (
           <div className="error-state">
             <p>Error: {error}</p>
           </div>
         )}
         
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
  )
}

export default StudyWindow
