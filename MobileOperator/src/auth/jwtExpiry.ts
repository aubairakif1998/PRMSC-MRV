/**
 * Detect JWT expiry from the `exp` claim (no signature verification — same as typical client checks).
 * Non-JWT or opaque tokens return "not expired" so the server can still respond with 401.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = (globalThis as unknown as { atob: (data: string) => string }).atob(
      padded,
    );
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

/** @param skewSeconds — treat token as expired slightly before `exp` to avoid edge races */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  const expMs = payload.exp * 1000;
  return Date.now() >= expMs - skewSeconds * 1000;
}
