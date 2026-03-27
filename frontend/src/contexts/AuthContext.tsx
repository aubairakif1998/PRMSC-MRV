import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";
import type { AuthUser, LoginResponse } from "../types/auth";

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
      setUser(JSON.parse(savedUser) as AuthUser);
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

      localStorage.setItem("mrv_token", token);
      localStorage.setItem("mrv_user", JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error?.response?.data?.message || "Login failed",
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
