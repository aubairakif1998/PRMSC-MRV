import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";
import {
  isPortalRole,
  normalizeRole,
  type UserRole,
} from "../constants/roles";
import { getApiErrorMessage } from "../lib/api-error";
import type { AuthUser, LoginResponse } from "../types/auth";

function coerceAuthUser(raw: {
  id: string;
  name: string;
  role: string;
  tehsils?: string[] | null;
  water_system_ids?: string[] | null;
  /** Legacy single-tehsil field from older sessions */
  tehsil?: string | null;
}): AuthUser {
  const role = normalizeRole(raw.role) ?? (raw.role as UserRole);
  const tehsils = Array.isArray(raw.tehsils)
    ? raw.tehsils.filter(Boolean)
    : raw.tehsil
      ? [raw.tehsil].filter(Boolean)
      : [];
  const water_system_ids = Array.isArray(raw.water_system_ids)
    ? raw.water_system_ids.map(String).filter(Boolean)
    : undefined;
  return {
    id: raw.id,
    name: raw.name,
    role,
    tehsils,
    ...(water_system_ids?.length ? { water_system_ids } : {}),
  };
}

type LoginResult = { success: true } | { success: false; message: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mrv_token");
    const savedUser = localStorage.getItem("mrv_user");

    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as {
          id: string;
          name: string;
          role: string;
          tehsils?: string[] | null;
          water_system_ids?: string[] | null;
          tehsil?: string | null;
        };
        const hydrated = coerceAuthUser(parsed);
        if (!isPortalRole(hydrated.role)) {
          localStorage.removeItem("mrv_user");
          localStorage.removeItem("mrv_token");
        } else {
          setUser(hydrated);
        }
      } catch {
        localStorage.removeItem("mrv_user");
        localStorage.removeItem("mrv_token");
      }
    }
    setLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResult> => {
    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      const { token, user: userData } = response.data;
      const user = coerceAuthUser({
        id: String(userData.id),
        name: userData.name,
        role: userData.role,
        tehsils: userData.tehsils,
        water_system_ids: userData.water_system_ids,
      });

      if (!isPortalRole(user.role)) {
        return {
          success: false,
          message:
            "This portal is for Tehsil Manager Operators, Manager Operations, and MRV COO only.",
        };
      }

      localStorage.setItem("mrv_token", token);
      localStorage.setItem("mrv_user", JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        message: getApiErrorMessage(error, "Login failed"),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("mrv_token");
    localStorage.removeItem("mrv_user");
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, loading }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
