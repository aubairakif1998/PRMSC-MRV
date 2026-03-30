import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../storage/keys';
import { getJson, removeKey, setJson } from '../storage/jsonStorage';
import type { AuthUser, LoginResponse } from '../types/auth';
import { login as loginApi } from '../api/auth';
import { isJwtExpired } from './jwtExpiry';
import { setSessionExpiredHandler } from './sessionExpired';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
};
// type AuthState = {
//   user: AuthUser | null
//   token: string | null
//   loading: boolean
// }
type LoginResult = { ok: true } | { ok: false; message: string };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const [token, user] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.token),
        getJson<AuthUser>(STORAGE_KEYS.user),
      ]);
      if (cancelled) return;
      if (token && isJwtExpired(token)) {
        await Promise.all([
          removeKey(STORAGE_KEYS.user),
          removeKey(STORAGE_KEYS.token),
        ]);
        setState({ token: null, user: null, loading: false });
        return;
      }
      setState({ token: token ?? null, user: user ?? null, loading: false });
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const data: LoginResponse = await loginApi(email, password);
        if (data.user.role !== 'operator') {
          await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEYS.token),
            AsyncStorage.removeItem(STORAGE_KEYS.user),
          ]);
          setState(s => ({ ...s, token: null, user: null }));
          return {
            ok: false,
            message: 'This mobile app is for operators only.',
          };
        }
        await AsyncStorage.setItem(STORAGE_KEYS.token, data.token);
        await setJson(STORAGE_KEYS.user, data.user);
        setState({ token: data.token, user: data.user, loading: false });
        return { ok: true };
      } catch {
        return {
          ok: false,
          message: 'Login failed. Check credentials and connection.',
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await Promise.all([
      removeKey(STORAGE_KEYS.user),
      removeKey(STORAGE_KEYS.token),
    ]);
    setState({ user: null, token: null, loading: false });
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void logout();
    });
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  const value: AuthContextValue = useMemo(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
