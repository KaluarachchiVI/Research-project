"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Surface } from "../components/Surface";
import { DistractionPeriod, fetchDistractionHistory } from "../../lib/api";
import { useToasts } from "../components/ToastProvider";

function formatDuration(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const diff = (e - s) / 1000;
  
  if (diff < 60) return `${Math.round(diff)}s`;
  const m = Math.floor(diff / 60);
  const sec = Math.round(diff % 60);
  return `${m}m ${sec}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DistractionsPage() {
  const { addToast } = useToasts();
  const { data: periods, error } = useSWR<DistractionPeriod[]>(
    "distractions",
    () => fetchDistractionHistory(50),
    { refreshInterval: 10000 }
  );

  useEffect(() => {
    if (error) {
      addToast("Failed to load distraction history", "error");
    }
  }, [error, addToast]);

  return (
    <main className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-100">Distraction History</h2>
            <div className="text-sm text-slate-400">Latest 50 events</div>
        </div>

        <Surface padding="lg" className="surface">
            {periods && periods.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="border-b border-slate-700/50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Start Time</th>
                                <th className="px-4 py-3 font-semibold">End Time</th>
                                <th className="px-4 py-3 font-semibold">Duration</th>
                                <th className="px-4 py-3 font-semibold text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {periods.map((p, i) => (
                                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-3 font-mono text-slate-400">{formatTime(p.start_time)}</td>
                                    <td className="px-4 py-3 font-mono text-slate-400">{formatTime(p.end_time)}</td>
                                    <td className="px-4 py-3 font-medium text-slate-200">{formatDuration(p.start_time, p.end_time)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
                                            Distracted
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-12 text-center text-slate-500">
                    {periods ? "No distraction periods recorded." : "Loading..."}
                </div>
            )}
        </Surface>
      </div>
    </main>
  );
}
