import { useMutation } from '@tanstack/react-query'
import {
  loginUser as loginUserService,
  registerUser as registerUserService,
  type LoginInput,
  type RegisterInput,
} from '../services/authService'

export function useAuthApi() {
  const registerUserMutation = useMutation({
    mutationFn: (payload: RegisterInput) => registerUserService(payload),
  })

  const loginUserMutation = useMutation({
    mutationFn: (payload: LoginInput) => loginUserService(payload),
  })

  return {
    registerUser: registerUserMutation.mutateAsync,
    loginUser: loginUserMutation.mutateAsync,
  }
}

