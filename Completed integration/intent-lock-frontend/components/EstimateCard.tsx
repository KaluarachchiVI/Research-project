"use client";

import { useState } from "react";
import { useEstimatorContext } from "./providers/EstimatorProvider";
import { EstimateResponse } from "../lib/api";
import { Target, Clock, Layers, AlertCircle, Loader2 } from "lucide-react";

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

  const [detailsOpen, setDetailsOpen] = useState(false);

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
            {/* Progress bar intentionally removed; keep only badge for dynamic state */}
          </div>
        </div>

        {/* Load State Chip */}
        <div className="flex items-center">
          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold capitalize border ${loadStateClasses}`}>
            {loadState}
          </span>
        </div>
      </div>

      {/* Details dropdown containing variance, residual, quality, CI95, active flags, scheduler state, and timestamp */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => setDetailsOpen((s) => !s)}
          className="flex items-center justify-between w-full text-left px-2 py-2 bg-transparent"
        >
          <span className="text-sm font-semibold">Details</span>
          <span className="text-xs text-gray-500">{detailsOpen ? "Hide" : "Show"}</span>
        </button>

        {detailsOpen && (
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Variance</p>
              <p className="text-sm font-semibold text-gray-900 font-mono">{formatNumber(currentEstimate.variance, 4)}</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Residual</p>
              <p className="text-sm font-semibold text-gray-900 font-mono">{formatNumber(currentEstimate.residual, 3)}</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Quality</p>
              <p className="text-sm font-semibold text-gray-900 font-mono">{formatNumber(currentEstimate.quality, 2)}</p>
            </div>

            {currentEstimate.ci95 !== undefined && (
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500 mb-1">95% Confidence Interval</p>
                <p className="text-sm font-semibold text-gray-900 font-mono">±{formatNumber(currentEstimate.ci95, 3)}</p>
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Active Context Flags</p>
              <div className="flex flex-wrap gap-2">
                {contextValues.length ? (
                  contextValues.map((flag) => (
                    <span key={flag} className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded">{flag}</span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">None detected</span>
                )}
              </div>
            </div>

            {currentEstimate.scheduler_state && (
              <div className="p-3 bg-purple-50 rounded-md border border-purple-100">
                <p className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wider">Scheduler State</p>
                <p className="text-sm font-semibold text-purple-900 capitalize">{currentEstimate.scheduler_state}</p>
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Captured At</p>
              <p className="text-sm font-semibold text-gray-900">{new Date(currentEstimate.timestamp).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

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
