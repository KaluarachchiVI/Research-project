export type ExitPrediction = "impulsive" | "genuine";

const DEFAULT_BASE = "http://127.0.0.1:5000";

function schedulerBase(): string {
  return (process.env.NEXT_PUBLIC_SCHEDULER_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type StartTimeBlockSessionRequest = {
  user_id: string;
  start_time: string;
  end_time: string;
  task_type?: string;
  chronotype?: string;
  algorithm?: string;
  previous_metrics?: unknown;
};

export async function startTimeBlockSession(body: StartTimeBlockSessionRequest): Promise<{ session_id: string; schedule?: unknown }> {
  const base = schedulerBase();
  return fetchJson(`${base}/api/time-block/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type EndTimeBlockSessionRequest = {
  session_id: string;
  auto_sync?: boolean;
  auto_compute_metrics?: boolean;
  intent_prediction?: ExitPrediction | null;
  friction_level?: number | null;
  intent_exit_event_id?: number | null;
  intent_reason?: string | null;
  intent_reason_custom?: string | null;
};

export async function endTimeBlockSession(body: EndTimeBlockSessionRequest): Promise<unknown> {
  const base = schedulerBase();
  return fetchJson(`${base}/api/time-block/end`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getTimeBlockRecommendation(sessionId: string): Promise<{ work_interval?: number; break_duration?: number; explanation?: string } & Record<string, unknown>> {
  const base = schedulerBase();
  const url = `${base}/api/time-block/recommendation?session_id=${encodeURIComponent(sessionId)}`;
  return fetchJson(url, { method: "GET" });
}

export type EndTimeBlockIntervalRequest = {
  session_id: string;
  interval_type?: "work" | "break";
  metrics?: Record<string, unknown>;
};

export async function endTimeBlockInterval(body: EndTimeBlockIntervalRequest): Promise<any> {
  const base = schedulerBase();
  return fetchJson(`${base}/api/time-block/end-interval`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
