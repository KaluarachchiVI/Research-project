/**
 * Config for Yuvidu when run standalone or embedded in IntentLock.
 * - API base: set via VITE_YUVIDU_API_BASE (e.g. when IntentLock runs the backend).
 * - user_id / from_session: passed as URL query params when embedded in IntentLock planner iframe.
 */


//127.0.0.1 and localhost are same

const API_BASE =
  (import.meta.env.VITE_YUVIDU_API_BASE as string) || "http://localhost:5001";

function getSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, "");
}

/** When embedded in IntentLock, the host passes auth-derived user_id. */
export function getUserId(): string | null {
  return getSearchParams().get("user_id");
}

/** When opened from a session (e.g. "Plan next block"), IntentLock passes the session id. */
export function getFromSession(): string | null {
  return getSearchParams().get("from_session");
}

/** Build URL for an API path (no leading slash on path). */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${p}`;
}

