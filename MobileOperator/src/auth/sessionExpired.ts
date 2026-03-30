type SessionExpiredHandler = () => void | Promise<void>;

let handler: SessionExpiredHandler | null = null;

/** Called from `AuthProvider` so expired sessions clear state and return to sign-in. */
export function setSessionExpiredHandler(fn: SessionExpiredHandler | null): void {
  handler = fn;
}

/** Invoked by the API client on 401 (except login). */
export function notifySessionExpired(): void {
  void handler?.();
}
