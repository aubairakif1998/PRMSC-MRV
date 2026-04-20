import Config from 'react-native-config';

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

const ENV = String((Config as unknown as { ENV?: unknown }).ENV ?? '')
  .trim()
  .toUpperCase();

const isProdEnv = ENV === 'PROD' || ENV === 'PRODUCTION';
const isDevEnv = ENV === 'DEV' || ENV === 'DEVELOPMENT' || ENV === 'LOCAL';

const PROD_API_ORIGIN = 'https://prmsc-mrv-api.vercel.app/';
const DEV_API_ORIGIN = 'http://127.0.0.1:5001';

/**
 * Priority order:
 * 1) Explicit `API_URL` from `.env` (most reliable; overrides ENV)
 * 2) `ENV=PROD|DEV` default origins
 * 3) Fallback to dev origin
 */
const EXPLICIT = normalizeApiUrl(String((Config as unknown as { API_URL?: unknown }).API_URL ?? ''));

export const API_URL = EXPLICIT
  ? EXPLICIT
  : isProdEnv
    ? normalizeApiUrl(PROD_API_ORIGIN)
    : isDevEnv
      ? normalizeApiUrl(DEV_API_ORIGIN)
      : normalizeApiUrl(DEV_API_ORIGIN);
