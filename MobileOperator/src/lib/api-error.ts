/**
 * Matches web `frontend/src/lib/api-error.ts` — extracts server message from Axios errors.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = (error as Record<string, unknown>).response;
    if (typeof maybeResponse === 'object' && maybeResponse !== null) {
      const maybeData = (maybeResponse as Record<string, unknown>).data;
      if (typeof maybeData === 'object' && maybeData !== null) {
        const message = (maybeData as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim()) return message;

        const apiError = (maybeData as Record<string, unknown>).error;
        if (typeof apiError === 'string' && apiError.trim()) return apiError;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
