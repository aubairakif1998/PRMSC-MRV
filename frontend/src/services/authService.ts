import api from '../api/api'

export type LoginInput = { email: string; password: string }

export const loginUser = async ({ email, password }: LoginInput) => {
  const response = await api.post('/auth/login', { email, password })
  const data = response.data as { token: string; user: unknown }
  localStorage.setItem('mrv_token', data.token)
  localStorage.setItem('mrv_user', JSON.stringify(data.user))
  return data
}

export async function forgotPassword(email: string): Promise<{ message: string; reset_token?: string }> {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data as { message: string; reset_token?: string };
}

export async function resetPassword(token: string, new_password: string): Promise<{ message: string }> {
  const res = await api.post("/auth/reset-password", { token, new_password });
  return res.data as { message: string };
}

export async function changePassword(current_password: string, new_password: string): Promise<{ message: string }> {
  const res = await api.post("/auth/change-password", { current_password, new_password });
  return res.data as { message: string };
}

