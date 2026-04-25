/**
 * Typed client for the Adaptive Scheduler API (older/src/api/app.py).
 *
 * Base URL is read from NEXT_PUBLIC_SCHEDULER_API_BASE; falls back to
 * http://127.0.0.1:5000 to match the integrated start-all.ps1 launcher.
 */

const SCHEDULER_BASE = (
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000"
).replace(/\/$/, "");

const TOKEN_STORAGE_KEY = "intentlock_token";

export type ExitPrediction = "impulsive" | "genuine";

export interface ScheduledIntervalDto {
  start_time: string;
  end_time: string;
  interval_type: "work" | "break";
  duration_minutes: number;
  work_interval: number;
  break_duration: number;
}

export interface SessionScheduleDto {
  total_duration_minutes: number;
  work_time_minutes: number;
  break_time_minutes: number;
  intervals: ScheduledIntervalDto[];
}

export interface StartTimeBlockSessionRequest {
  user_id: string;
  start_time: string;
  end_time: string;
  task_type?: string;
  chronotype?: string;
  algorithm?: string;
  previous_metrics?: unknown;
}

export interface StartTimeBlockSessionResponse {
  session_id: string;
  schedule: SessionScheduleDto;
}

export interface EndTimeBlockSessionRequest {
  session_id: string;
  auto_sync?: boolean;
  auto_compute_metrics?: boolean;
  intent_prediction?: ExitPrediction | null;
  friction_level?: number | null;
  intent_exit_event_id?: number | null;
  intent_reason?: string | null;
  intent_reason_custom?: string | null;
}

export interface EndTimeBlockSessionResponse {
  status?: string;
  error?: string;
  session_id?: string;
  metrics?: unknown;
  [key: string]: unknown;
}

export interface TimeBlockRecommendation {
  work_interval?: number;
  break_duration?: number;
  explanation?: string;
  cognitive_load?: number | null;
  error?: string;
  [key: string]: unknown;
}

export interface EndTimeBlockIntervalRequest {
  session_id: string;
  interval_type?: "work" | "break";
  metrics?: Record<string, unknown>;
}

export interface EndTimeBlockIntervalResponse {
  status?: string;
  interval_type?: "work" | "break";
  next_action?: {
    work_interval: number;
    break_duration: number;
  };
  next_recommendation?: {
    work_interval: number;
    break_duration: number;
  };
  next_interval?: {
    type: "work" | "break" | null;
    duration_minutes: number | null;
  };
  reward_computed?: {
    immediate_reward: number;
    r_progress?: number;
    r_relief?: number;
  };
  metadata?: Record<string, unknown>;
  error?: string;
}

class SchedulerApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Scheduler API error (${status})`);
    this.name = "SchedulerApiError";
    this.status = status;
    this.body = body;
  }
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${SCHEDULER_BASE}${path}`, { ...init, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Scheduler API error (${res.status})`;
    throw new SchedulerApiError(res.status, body, message);
  }

  return body as T;
}

export function startTimeBlockSession(
  payload: StartTimeBlockSessionRequest,
): Promise<StartTimeBlockSessionResponse> {
  return request<StartTimeBlockSessionResponse>("/api/time-block/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function endTimeBlockSession(
  payload: EndTimeBlockSessionRequest,
): Promise<EndTimeBlockSessionResponse> {
  return request<EndTimeBlockSessionResponse>("/api/time-block/end", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTimeBlockRecommendation(
  sessionId: string,
): Promise<TimeBlockRecommendation> {
  const qs = new URLSearchParams({ session_id: sessionId }).toString();
  return request<TimeBlockRecommendation>(
    `/api/time-block/recommendation?${qs}`,
    { method: "GET" },
  );
}

export function endTimeBlockInterval(
  payload: EndTimeBlockIntervalRequest,
): Promise<EndTimeBlockIntervalResponse> {
  return request<EndTimeBlockIntervalResponse>(
    "/api/time-block/end-interval",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export { SchedulerApiError };
