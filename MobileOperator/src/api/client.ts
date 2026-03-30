import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { isJwtExpired } from '../auth/jwtExpiry';
import { notifySessionExpired } from '../auth/sessionExpired';
import { API_URL } from '../config/env';
import { STORAGE_KEYS } from '../storage/keys';
import AsyncStorage from '@react-native-async-storage/async-storage';

function isAuthLoginRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const u = config?.url ?? '';
  return u.includes('/auth/login');
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.token);
  if (token) {
    if (isJwtExpired(token)) {
      notifySessionExpired();
      return Promise.reject(new Error('Session expired'));
    }
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    // Expired or invalid session: clear auth and show sign-in (not wrong-password on login).
    if (status === 401 && !isAuthLoginRequest(error.config)) {
      notifySessionExpired();
    }
    return Promise.reject(error);
  },
);
