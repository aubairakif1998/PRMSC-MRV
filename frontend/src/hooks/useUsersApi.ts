import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listUsers,
  onboardOperator,
  type OnboardOperatorPayload,
} from '../services/usersService'

export function useUsersApi() {
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => listUsers(),
    enabled: false,
  })

  const onboardMutation = useMutation({
    mutationFn: (payload: OnboardOperatorPayload) => onboardOperator(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users', 'list'] })
    },
  })

  return {
    fetchUsers: () => usersQuery.refetch(),
    users: usersQuery.data?.users,
    usersLoading: usersQuery.isFetching,
    onboardOperator: onboardMutation.mutateAsync,
    onboardLoading: onboardMutation.isPending,
  }
}
