/**
 * Adaptive scheduler (Flask) time-block API client.
 * Set NEXT_PUBLIC_SCHEDULER_API_BASE (e.g. http://127.0.0.1:5000) to enable.
 */

const baseUrl = () =>
  (process.env.NEXT_PUBLIC_SCHEDULER_API_BASE ?? "http://127.0.0.1:5000").replace(
    /\/$/,
    ""
  );

export type ExitPrediction = "impulsive" | "genuine";

export type StartTimeBlockParams = {
  user_id: string;
  start_time: string;
  end_time: string;
  task_type: string;
  chronotype: string;
  algorithm: string;
  previous_metrics: unknown | null;
};

export type StartTimeBlockResult = {
  session_id: string;
  schedule?: unknown;
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.slice(0, 200) || res.statusText);
  }
}

export async function startTimeBlockSession(
  body: StartTimeBlockParams
): Promise<StartTimeBlockResult> {
  const res = await fetch(`${baseUrl()}/api/time-block/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await parseJson(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data.error ?? res.statusText));
  }
  if (typeof data.session_id !== "string") {
    throw new Error("Scheduler response missing session_id");
  }
  return data as StartTimeBlockResult;
}

export type EndTimeBlockSessionParams = {
  session_id: string;
  auto_sync?: boolean;
  auto_compute_metrics?: boolean;
  intent_prediction: ExitPrediction | null;
  friction_level: number | null;
  intent_exit_event_id: number | null;
  intent_reason: string | null;
  intent_reason_custom: string | null;
};

export async function endTimeBlockSession(
  body: EndTimeBlockSessionParams
): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/api/time-block/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export type TimeBlockRecommendation = {
  work_interval?: number;
  break_duration?: number;
  explanation?: string;
  error?: string;
};

export async function getTimeBlockRecommendation(
  sessionId: string
): Promise<TimeBlockRecommendation> {
  const q = new URLSearchParams({ session_id: sessionId });
  const res = await fetch(
    `${baseUrl()}/api/time-block/recommendation?${q.toString()}`,
    { headers: { Accept: "application/json" } }
  );
  const data = (await parseJson(res)) as TimeBlockRecommendation;
  return data;
}

export type EndIntervalParams = {
  session_id: string;
  interval_type: "work" | "break";
  metrics: Record<string, number>;
};

export type EndIntervalResult = {
  next_action?: { work_interval?: number; break_duration?: number };
  next_recommendation?: { work_interval?: number; break_duration?: number };
  reward_computed?: { immediate_reward?: number };
  error?: string;
};

export async function endTimeBlockInterval(
  body: EndIntervalParams
): Promise<EndIntervalResult> {
  const res = await fetch(`${baseUrl()}/api/time-block/end-interval`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await parseJson(res)) as EndIntervalResult;
  return data;
}
