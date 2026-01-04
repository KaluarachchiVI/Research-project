"use client";
import { useState } from "react";

const BACKEND_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [reason, setReason] = useState<string | null>(null);

  const handleExitAttempt = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${BACKEND_URL}/predict-exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_minutes: 45,
          typing_speed: 100,
        }),
      });

      const data = await response.json();
      setResult(data.prediction);

      if (data.prediction === "Impulsive") {
        await fetch(`${BACKEND_URL}/log-exit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            exit_type: "Impulsive",
            reason: reason || "Unknown",
          }),
        });
      }
    } catch (error) {
      console.error("Error Calling Backend:", error);
      setResult("Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Intent-Lock Detection</h1>
      <p>Simulated study session in progress...</p>

      <button
        onClick={handleExitAttempt}
        style={{
          padding: "10px 20px",
          backgroundColor: "blue",
          color: "white",
          fontSize: "16px",
          cursor: "pointer",
          marginTop: "20px",
        }}
      >
        Exit Study Session
      </button>

      {result === "Impulsive" && (
        <div style={{ marginTop: "20px" }}>
          <p>Why Are You Exiting ?</p>
          <select
            value={reason || ""}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          >
            <option value="">Select a Reason</option>
            <option value="boredom">Boredom</option>
            <option value="tired">Tired</option>
            <option value="distraction">Distraction</option>
            <option value="task_completed">Task Completed</option>
          </select>
        </div>
      )}

      {loading && <p>Analyzing Intent...</p>}

      {result && (
        <div style={{ marginTop: "20px" }}>
          <h3>Intent-Lock Decision</h3>

          <p>
            {result === "Impulsive"
              ? " You Seem Highly focused. Consider staying abit longer."
              : "Exit allowed. You've had a productive session."}
          </p>
        </div>
      )}
    </main>
  );
}
