export type UserRole = 'operator' | 'analyst' | 'environment_manager' | 'operations_department'

export type AuthUser = {
  id: string
  name: string
  role: UserRole
}

export type LoginResponse = {
  token: string
  user: AuthUser
}

