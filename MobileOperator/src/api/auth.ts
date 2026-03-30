import { apiClient } from './client';
import type { LoginResponse } from '../types/auth';

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await apiClient.post('/auth/login', { email, password });
  return res.data as LoginResponse;
}
