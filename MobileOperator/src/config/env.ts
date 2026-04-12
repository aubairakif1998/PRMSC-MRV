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

const PROD_API_ORIGIN = 'https://prmsc-mrv.onrender.com';
const DEV_API_ORIGIN = 'http://127.0.0.1:5001';

export const API_URL = isProdEnv
  ? normalizeApiUrl(PROD_API_ORIGIN)
  : isDevEnv
  ? normalizeApiUrl(DEV_API_ORIGIN)
  : normalizeApiUrl(String(Config.API_URL || '')) ||
    normalizeApiUrl(DEV_API_ORIGIN);
