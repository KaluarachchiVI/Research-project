"use client";

import { useEstimatorContext } from "./providers/EstimatorProvider";
import { EstimateResponse } from "../lib/api";
import { Target, Activity, Zap, Cpu, Clock, Layers, AlertCircle, Loader2 } from "lucide-react";

function formatNumber(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function getLoadStateClasses(state: string): string {
  const normalized = state.toLowerCase();
  if (normalized.includes("high")) return "bg-red-100 text-red-700 border-red-200";
  if (normalized.includes("medium")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (normalized.includes("low")) return "bg-green-100 text-green-700 border-green-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function getLoadColor(load: number): string {
  if (load < 0.33) return "bg-green-500";
  if (load < 0.66) return "bg-yellow-500";
  return "bg-red-500";
}

function MetricItem({ 
  icon, 
  label, 
  value, 
  hint 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1" title={hint}>
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900 font-mono">{value}</div>
    </div>
  );
}

interface EstimateCardProps {
  estimate?: EstimateResponse | null;
  isLoading?: boolean;
  error?: string | null;
}

export function EstimateCard({ estimate, isLoading, error }: EstimateCardProps) {
  const contextEstimate = useEstimatorContext();
  const currentEstimate = estimate ?? contextEstimate.estimate;
  const currentError = error ?? contextEstimate.error;
  const currentIsLoading = isLoading ?? !contextEstimate.isConnected;

  if (currentIsLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500">Loading estimate data...</span>
        </div>
      </div>
    );
  }

  if (currentError) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md border border-red-200">
        <div className="flex items-center justify-center py-12">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="ml-3 text-red-600">{currentError}</span>
        </div>
      </div>
    );
  }

  if (!currentEstimate) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <Target className="w-8 h-8 text-gray-400" />
          <span className="ml-3 text-gray-500">No estimate data available</span>
        </div>
      </div>
    );
  }

  const contextValues = Object.entries(currentEstimate.context_flags ?? {})
    .filter(([_, active]) => active)
    .map(([key]) => key);
  
  const loadState = currentEstimate.load_state ?? "unknown cognitive load";
  const loadStateClasses = getLoadStateClasses(loadState);
  const loadPercentage = Math.round(currentEstimate.load * 100);
  const loadColor = getLoadColor(currentEstimate.load);
  // Map textual load state to a visual progress width so the bar follows the label
  const loadLevelWidth = loadState.includes("high")
    ? 100
    : loadState.includes("medium")
    ? 67
    : loadState.includes("low")
    ? 25
    : Math.min(100, loadPercentage);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Layers size={14} />
            <span>Hop #{currentEstimate.hop_index}</span>
          </div>
          <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-cyan-100 text-cyan-700 border border-cyan-200">
            {currentEstimate.baseline_active ? "Calibrating" : "Active Tracking"}
          </span>
        </div>

        {/* Load Factor Display */}
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-cyan-600" size={24} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl font-bold text-gray-900">
                Load Factor: <span className="text-cyan-600">{formatNumber(currentEstimate.load, 2)}</span>
              </span>
              <span className="text-sm font-semibold text-gray-700 capitalize">{loadState}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${loadColor}`}
                style={{ width: `${loadLevelWidth}%` }}
              />
            </div>
          </div>
        </div>

        {/* Load State Chip */}
        <div className="flex items-center">
          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold capitalize border ${loadStateClasses}`}>
            {loadState}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 mb-6">
        <MetricItem 
          icon={<Activity size={16} className="text-gray-500" />} 
          label="Variance" 
          value={formatNumber(currentEstimate.variance, 4)} 
          hint="Model uncertainty"
        />
        <MetricItem 
          icon={<Zap size={16} className="text-gray-500" />} 
          label="Residual" 
          value={formatNumber(currentEstimate.residual, 3)} 
          hint="Innovation error"
        />
        <MetricItem 
          icon={<Cpu size={16} className="text-gray-500" />} 
          label="Quality" 
          value={formatNumber(currentEstimate.quality, 2)} 
          hint="Signal coverage"
        />
      </div>

      {/* Additional Metrics */}
      {currentEstimate.ci95 !== undefined && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500 mb-1">95% Confidence Interval</p>
            <p className="text-sm font-semibold text-gray-900 font-mono">
              ±{formatNumber(currentEstimate.ci95, 3)}
            </p>
          </div>
          {currentEstimate.onboarding_state && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Onboarding State</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {currentEstimate.onboarding_state}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Context Flags */}
      {contextValues.length > 0 && (
        <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Active Context Flags</p>
          <div className="flex flex-wrap gap-2">
            {contextValues.map((flag) => (
              <span 
                key={flag}
                className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scheduler State */}
      {currentEstimate.scheduler_state && (
        <div className="mb-6 p-3 bg-purple-50 rounded-md border border-purple-100">
          <p className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wider">Scheduler State</p>
          <p className="text-sm font-semibold text-purple-900 capitalize">
            {currentEstimate.scheduler_state}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>{new Date(currentEstimate.timestamp).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Context:</span>
          <span>{contextValues.length ? `${contextValues.length} active` : "None detected"}</span>
        </div>
      </div>
    </div>
  );
}

export default EstimateCard;
