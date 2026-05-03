export function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log("[IntentLockDesktop]", ...args);
}

export function warn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.warn("[IntentLockDesktop]", ...args);
}

export function err(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error("[IntentLockDesktop]", ...args);
}
