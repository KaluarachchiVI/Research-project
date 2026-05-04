/**
 * v1 uses CONNECT-based filtering only (no HTTPS MITM / user CA).
 * Reserved for a future phase that installs a root CA for full MITM.
 */
export async function ensureCaInstalled(): Promise<void> {
  return;
}
