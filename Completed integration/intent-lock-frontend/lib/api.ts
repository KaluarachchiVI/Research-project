/**
 * API utilities for Cognitive Load Estimator
 * Handles SSE streaming and REST API calls to the Praboth backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

function authHeaders(base?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(base ?? {}) };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}

// Type definitions
export interface EstimateResponse {
  load: number;
  residual: number;
  hop_index: number;
  baseline_active: boolean;
  scheduler_state?: string;
  pending_prompt?: {
    prompt_id: number;
    reason: string;
  };
  timestamp: string;
  variance: number;
  ci95?: number;
  quality: number;
  load_state: string;
  context_flags?: Record<string, boolean>;
  onboarding_state?: string;
  active_prompt_id?: number;
}

export interface TelemetryResponse {
  scheduler_state?: string;
  events_processed?: number;
  uptime_seconds?: number;
  last_event_time?: string;
  context_flags?: Record<string, boolean> | string[];
  running_apps?: string[];
  inactivity_gap_seconds?: number | null;
  consent_granted?: boolean;
  privacy_pause?: boolean;
  next_prompt_seconds?: number | null;
  onboarding_percent?: number | null;
  onboarding_message?: string | null;
  policy_prompted?: number | null;
  policy_suppressed?: number | null;
  active_prompt_id?: number | null;
  hop_index?: number | null;
  residual?: number | null;
  variance?: number | null;
  baseline_active?: boolean | null;
  load_state?: string | null;
  pending_prompt_reason?: string | null;
  suppression_reason?: string | null;
  cooldown_seconds?: number | null;
  snooze_seconds?: number | null;
}

export interface PendingPromptResponse {
  prompt: {
    prompt_id: number;
    reason: string;
  } | null;
}

export interface StateStreamPayload {
  estimate: EstimateResponse | null;
  telemetry: TelemetryResponse;
}

export interface PermissionsStatus {
  privacy_pause: boolean;
  consent_granted: boolean;
  context_blocklist: string[];
  context_catalog?: string[];
  idle_block_seconds?: number;
}

export interface ConsentEntry {
  timestamp: string;
  granted: boolean;
  reason?: string | null;
}

export interface PolicyEvent {
  occurred_at: string;
  event_type: string;
  reason?: string | null;
  metadata: Record<string, unknown>;
}

export interface TelemetryMetric {
  snapshot_at: string;
  metric_type: string | null;
  metric_value: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Fetch the latest cognitive load estimate
 */
export async function fetchEstimate(): Promise<EstimateResponse> {
  const response = await fetch(`${API_BASE_URL}/estimate`);
  if (!response.ok) {
    throw new Error(`Failed to fetch estimate: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch telemetry data
 */
export async function fetchTelemetry(): Promise<TelemetryResponse> {
  const response = await fetch(`${API_BASE_URL}/telemetry`);
  if (!response.ok) {
    throw new Error(`Failed to fetch telemetry: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch pending EMA prompt
 */
export async function fetchPendingPrompt(): Promise<PendingPromptResponse> {
  const response = await fetch(`${API_BASE_URL}/ema/pending`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pending prompt: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Subscribe to SSE state stream
 * Returns a disconnect function
 */
export function subscribeStateStream(
  onMessage: (payload: StateStreamPayload) => void,
  onError: () => void,
  onOpen: () => void
): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/stream/state`);

  eventSource.onopen = () => {
    console.log('[EstimatorProvider] SSE connection opened');
    onOpen();
  };

  eventSource.onmessage = (event) => {
    try {
      const payload: StateStreamPayload = JSON.parse(event.data);
      onMessage(payload);
    } catch (error) {
      console.error('[EstimatorProvider] Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[EstimatorProvider] SSE connection error:', error);
    onError();
    eventSource.close();
  };

  // Return disconnect function
  return () => {
    console.log('[EstimatorProvider] Closing SSE connection');
    eventSource.close();
  };
}

/**
 * Submit EMA response
 */
export async function submitEmaResponse(
  promptId: number,
  rating: number,
  disposition: string,
  note?: string
): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/ema/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt_id: promptId,
      rating,
      disposition,
      note,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit EMA response: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Ingest an event
 */
export async function ingestEvent(
  source: string,
  payload: Record<string, unknown>,
  timestamp?: Date
): Promise<{ accepted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source,
      payload,
      timestamp: timestamp?.toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to ingest event: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch permissions status
 */
export async function fetchPermissions(): Promise<PermissionsStatus> {
  const response = await fetch(`${API_BASE_URL}/permissions`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch permissions: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update privacy pause setting
 */
export async function updatePrivacy(active: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/privacy`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ active }),
  });
  if (!response.ok) {
    throw new Error(`Privacy toggle failed: ${response.statusText}`);
  }
}

/**
 * Update consent setting
 */
export async function updateConsent(granted: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/consent`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ granted }),
  });
  if (!response.ok) {
    throw new Error(`Consent toggle failed: ${response.statusText}`);
  }
}

/**
 * Update context blocklist
 */
export async function updateContextBlocklist(entries: string[]): Promise<PermissionsStatus> {
  const response = await fetch(`${API_BASE_URL}/permissions/context`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) {
    throw new Error(`Context blocklist update failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update idle block settings
 */
export async function updateIdleBlock(seconds: number): Promise<PermissionsStatus> {
  const response = await fetch(`${API_BASE_URL}/permissions/idle`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ seconds }),
  });
  if (!response.ok) {
    throw new Error(`Idle block update failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch consent history
 */
export async function fetchConsentHistory(limit = 50): Promise<ConsentEntry[]> {
  const response = await fetch(`${API_BASE_URL}/policy/consent?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch consent history: ${response.statusText}`);
  }
  const payload = await response.json();
  return payload.entries;
}

/**
 * Fetch policy events
 */
export async function fetchPolicyEvents(limit = 100): Promise<PolicyEvent[]> {
  const response = await fetch(`${API_BASE_URL}/policy/events?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch policy events: ${response.statusText}`);
  }
  const payload = await response.json();
  return payload.events;
}

/**
 * Fetch telemetry feed
 */
export async function fetchTelemetryFeed(limit = 200): Promise<TelemetryMetric[]> {
  const response = await fetch(`${API_BASE_URL}/telemetry/feed?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch telemetry feed: ${response.statusText}`);
  }
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelemetryMetric);
}

/**
 * Check health status
 */
export async function checkHealth(): Promise<{
  status: string;
  baseline_active: boolean;
  hop_index: number;
}> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Failed to check health: ${response.statusText}`);
  }
  return response.json();
}
