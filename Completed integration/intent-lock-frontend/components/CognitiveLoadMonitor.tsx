"use client";

import { useEstimatorStream } from "../hooks/useEstimatorStream";

/**
 * CognitiveLoadMonitor - Example component demonstrating EstimatorProvider usage
 * 
 * This component displays real-time cognitive load data from the EstimatorProvider,
 * including current load, residual, connection status, and history statistics.
 * 
 * @example
 * ```tsx
 * import { CognitiveLoadMonitor } from "@/components/CognitiveLoadMonitor";
 * 
 * function Dashboard() {
 *   return (
 *     <div>
 *       <CognitiveLoadMonitor />
 *     </div>
 *   );
 * }
 * ```
 */
export function CognitiveLoadMonitor() {
  const { 
    estimate, 
    telemetry, 
    history, 
    status, 
    error, 
    isConnected,
    hydratedPrompt 
  } = useEstimatorStream({
    onConnect: () => console.log("[CognitiveLoadMonitor] Connected to estimator"),
    onDisconnect: () => console.log("[CognitiveLoadMonitor] Disconnected from estimator"),
  });

  // Calculate statistics from history
  const avgLoad = history.length > 0
    ? history.reduce((sum, point) => sum + point.load, 0) / history.length
    : 0;
  
  const maxLoad = history.length > 0
    ? Math.max(...history.map(point => point.load))
    : 0;
  
  const minLoad = history.length > 0
    ? Math.min(...history.map(point => point.load))
    : 0;

  const loadPercentage = estimate ? Math.round(estimate.load * 100) : 0;
  const residualPercentage = estimate ? Math.round(estimate.residual * 100) : 0;

  // Determine load level color
  const getLoadColor = (load: number) => {
    if (load < 0.33) return "bg-green-500";
    if (load < 0.66) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Cognitive Load Monitor</h2>
        <div className="flex items-center gap-2">
          <div 
            className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-sm text-gray-600">{status}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Pending Prompt Alert */}
      {hydratedPrompt && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm font-medium text-blue-800">EMA Prompt Available</p>
          <p className="text-xs text-blue-600 mt-1">Reason: {hydratedPrompt.reason}</p>
          <p className="text-xs text-blue-600">Prompt ID: {hydratedPrompt.prompt_id}</p>
        </div>
      )}

      {/* Main Metrics */}
      {estimate ? (
        <div className="space-y-4">
          {/* Cognitive Load Bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">Cognitive Load</label>
              <span className="text-sm font-semibold text-gray-900">{loadPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${getLoadColor(estimate.load)}`}
                style={{ width: `${loadPercentage}%` }}
              />
            </div>
          </div>

          {/* Residual Load Bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">Residual Load</label>
              <span className="text-sm font-semibold text-gray-900">{residualPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${residualPercentage}%` }}
              />
            </div>
          </div>

          {/* Additional Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Hop Index</p>
              <p className="text-lg font-semibold text-gray-900">{estimate.hop_index}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Baseline</p>
              <p className="text-lg font-semibold text-gray-900">
                {estimate.baseline_active ? "Active" : "Inactive"}
              </p>
            </div>
          </div>

          {/* Scheduler State */}
          {estimate.scheduler_state && (
            <div className="p-3 bg-purple-50 rounded-md">
              <p className="text-xs text-purple-600 mb-1">Scheduler State</p>
              <p className="text-sm font-semibold text-purple-900">{estimate.scheduler_state}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Waiting for estimate data...</p>
        </div>
      )}

      {/* History Statistics */}
      {history.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">History Statistics</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Average</p>
              <p className="text-sm font-semibold text-gray-900">
                {Math.round(avgLoad * 100)}%
              </p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Maximum</p>
              <p className="text-sm font-semibold text-gray-900">
                {Math.round(maxLoad * 100)}%
              </p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Minimum</p>
              <p className="text-sm font-semibold text-gray-900">
                {Math.round(minLoad * 100)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {history.length} data points recorded
          </p>
        </div>
      )}

      {/* Telemetry Info */}
      {telemetry && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Telemetry</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {telemetry.events_processed !== undefined && (
              <div>
                <span className="text-gray-500">Events: </span>
                <span className="font-medium">{telemetry.events_processed}</span>
              </div>
            )}
            {telemetry.uptime_seconds !== undefined && (
              <div>
                <span className="text-gray-500">Uptime: </span>
                <span className="font-medium">{Math.round(telemetry.uptime_seconds)}s</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
