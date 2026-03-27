import api from '../api/api'
import type { AnyRecord } from './types'

export type LoginInput = { email: string; password: string }
export type RegisterInput = { name: string; email: string; password: string; role: string }

export const registerUser = async ({ name, email, password, role }: RegisterInput) => {
  const response = await api.post('/auth/register', { name, email, password, role })
  return response.data as AnyRecord
}

export const loginUser = async ({ email, password }: LoginInput) => {
  const response = await api.post('/auth/login', { email, password })
  const data = response.data as { token: string; user: unknown }
  localStorage.setItem('mrv_token', data.token)
  localStorage.setItem('mrv_user', JSON.stringify(data.user))
  return data
}

