export type AnyRecord = Record<string, unknown>

export type QueryFilters = Record<string, string | number>

export const buildQueryString = (filters: QueryFilters = {}) => {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)])),
  ).toString()
  return params ? `?${params}` : ''
}

