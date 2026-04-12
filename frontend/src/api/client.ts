import axios, { type AxiosInstance } from "axios";

function normalizeApiUrl(raw: string): string {
  const trimmed = String(raw || "")
    .trim()
    .replace(/\/+$/, "");
  if (!trimmed) return "";
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

const ENV = String(import.meta.env.VITE_ENV || "")
  .trim()
  .toUpperCase();

const DEFAULT_API_ORIGIN =
  ENV === "PROD"
    ? "https://prmsc-mrv-api.vercel.app/"
    : "http://127.0.0.1:5001";

const API_URL =
  normalizeApiUrl(import.meta.env.VITE_API_URL) ||
  normalizeApiUrl(DEFAULT_API_ORIGIN) ||
  "http://127.0.0.1:5001/api";

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("mrv_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || "");
    const isAuthRequest = requestUrl.includes("/auth/login");

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem("mrv_token");
      localStorage.removeItem("mrv_user");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);
