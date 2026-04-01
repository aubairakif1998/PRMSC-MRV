import api from '../api/api'

export type OnboardOperatorPayload = {
  name: string
  email: string
  password: string
  water_system_ids: string[]
}

export type ListedUser = {
  id: string
  name: string
  email: string
  role: string
  tehsils: string[]
  water_system_ids: string[]
  created_at?: string | null
}

export const listUsers = async () => {
  const response = await api.get<{ users: ListedUser[] }>('/users/')
  return response.data
}

export const onboardOperator = async (payload: OnboardOperatorPayload) => {
  const response = await api.post('/users/onboard-operator', payload)
  return response.data as { message: string; user: ListedUser }
}
