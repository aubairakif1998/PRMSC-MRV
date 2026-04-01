function extractFromData(maybeData: Record<string, unknown>): string | null {
  const message = maybeData.message;
  if (typeof message === "string" && message.trim()) return message;

  const apiError = maybeData.error;
  if (typeof apiError === "string" && apiError.trim()) return apiError;

  const errors = maybeData.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const lines = errors.filter((e) => typeof e === "string") as string[];
    if (lines.length) return lines.slice(0, 8).join("\n");
  }
  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
) {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as Record<string, unknown>).response;
    if (typeof maybeResponse === "object" && maybeResponse !== null) {
      const maybeData = (maybeResponse as Record<string, unknown>).data;
      if (typeof maybeData === "object" && maybeData !== null) {
        const fromObj = extractFromData(maybeData as Record<string, unknown>);
        if (fromObj) return fromObj;
      }
      if (typeof maybeData === "string" && maybeData.trim()) {
        return maybeData;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
