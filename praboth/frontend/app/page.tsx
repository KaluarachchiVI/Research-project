"use client";

import { LayoutDashboard, Activity, AlertCircle, Settings, Navigation, Eye, CheckCircle2 } from "lucide-react";
import { EstimateCard } from "./components/EstimateCard";
import { PromptPanel } from "./components/PromptPanel";
import { Surface } from "./components/Surface";
import { useToasts } from "./components/ToastProvider";
import { AlertBanner } from "./components/home/AlertBanner";
import { NavigationPanel } from "./components/home/NavigationPanel";
import { VisualizationPanel } from "./components/home/VisualizationPanel";
import { WorkspacePanel } from "./components/home/WorkspacePanel";
import { useEstimatorStream } from "./hooks/useEstimatorStream";
import { toneForLoadState, Tone } from "../lib/format";
import styles from "./page.module.css";

export default function Home() {
  const { addToast } = useToasts();
  const { estimate, telemetry, history, status, error, hydratedPrompt, setHydratedPrompt } =
    useEstimatorStream({
      onConnect: () => addToast("Telemetry stream connected", "success"),
      onDisconnect: () => addToast("Telemetry stream disconnected", "error"),
    });

  const contextFlags = telemetry?.context_flags ?? (estimate ? Object.values(estimate.context_flags ?? {}) : []);
  const onboardingMessage = estimate?.onboarding_state?.message ?? telemetry?.onboarding_message ?? null;
  const onboardingPercent = estimate?.onboarding_state?.percent ?? telemetry?.onboarding_percent ?? null;
  const streamHealthy = !error;
  const loadState = telemetry?.load_state ?? estimate?.load_state ?? "Unknown Load";
  const loadTone: Tone = toneForLoadState(loadState);

  const promptEstimate = estimate
    ? {
        ...estimate,
        pending_prompt: estimate.pending_prompt ?? hydratedPrompt ?? undefined,
      }
    : null;

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      
      <div className="container-dashboard max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Connection & Calibration Alerts */}
        <div className="space-y-4">
          {error && (
            <AlertBanner
              tone="error"
              title="Connection Lost"
              message="The estimator service is offline or unreachable."
            />
          )}
          {onboardingMessage && (
            <AlertBanner
              tone="warning"
              title="Calibrating Baseline"
              message={`${onboardingMessage} (${Math.round((onboardingPercent || 0) * 100)}%)`}
            />
          )}
        </div>

        {/* Dashboard Title & Stats */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LayoutDashboard className="text-cyan-400" />
              Cognitive Overview
            </h1>
            <p className="text-slate-400 mt-2">Real-time workload estimation and interaction analytics.</p>
          </div>
          <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
             <div className="flex items-center gap-2 px-3 py-1">
                <div className={`w-2 h-2 rounded-full ${streamHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {streamHealthy ? 'Live Stream' : 'Offline'}
                </span>
             </div>
          </div>
        </div>

        {/* Primary Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Focus: Current Estimate & History */}
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Surface padding="lg" className="h-full">
                <div className="flex items-center gap-2 mb-6 text-cyan-400 font-bold uppercase tracking-widest text-xs">
                  <Activity size={16} />
                  <span>Real-time Load</span>
                </div>
                {estimate ? (
                  <EstimateCard estimate={estimate} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-center gap-4">
                    <Activity className="animate-pulse" size={48} />
                    <p>Wait for sensor data...</p>
                  </div>
                )}
              </Surface>

              <Surface padding="lg" className="h-full">
                <div className="flex items-center gap-2 mb-6 text-cyan-400 font-bold uppercase tracking-widest text-xs">
                  <Eye size={16} />
                  <span>Prompt Control</span>
                </div>
                {promptEstimate ? (
                  <PromptPanel
                    estimate={promptEstimate}
                    onSubmit={(result) => {
                      if (result) {
                        addToast(
                          `Prompt ${result.promptId} ${result.status}`,
                          result.status === "completed" ? "success" : "info"
                        );
                        setHydratedPrompt(null);
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-center gap-4">
                    <CheckCircle2 size={48} />
                    <p>No active prompts</p>
                  </div>
                )}
              </Surface>
            </div>

            <Surface padding="lg">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold flex items-center gap-2">
                  <Activity className="text-cyan-400" size={18} />
                  Load History
                </h3>
              </div>
              <VisualizationPanel history={history} />
            </Surface>
          </div>

          {/* Secondary Info: Context & Settings */}
          <div className="lg:col-span-4 space-y-8">
            <Surface padding="lg">
              <WorkspacePanel
                privacyPause={telemetry?.privacy_pause}
                consentGranted={telemetry?.consent_granted}
                loadState={loadState}
                loadTone={loadTone}
                contextFlags={contextFlags}
              />
            </Surface>

            <Surface padding="lg">
               <div className="space-y-6">
                <h3 className="font-bold flex items-center gap-2">
                  <Navigation className="text-cyan-400" size={18} />
                  Quick Access
                </h3>
                <NavigationPanel />
              </div>
            </Surface>

            <Surface padding="lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="text-slate-500" size={18} />
                  <span className="font-medium text-slate-300">Settings</span>
                </div>
                <button className="text-xs text-cyan-400 hover:underline">Manage</button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </main>
  );
}
