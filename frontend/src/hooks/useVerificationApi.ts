import { useMutation } from '@tanstack/react-query'
import {
  getAuditLogs as getAuditLogsService,
  getNotifications as getNotificationsService,
  getPendingSubmissions as getPendingSubmissionsService,
  getSubmissionDetail as getSubmissionDetailService,
  getVerificationStats as getVerificationStatsService,
  markAllNotificationsRead as markAllNotificationsReadService,
  markNotificationRead as markNotificationReadService,
  rejectSubmission as rejectSubmissionService,
  submitRecordForVerification as submitRecordForVerificationService,
  verifySubmission as verifySubmissionService,
  type QueryFilters,
} from '../services'

export function useVerificationApi() {
  const getPendingSubmissionsMutation = useMutation({
    mutationFn: () => getPendingSubmissionsService(),
  })
  const getVerificationStatsMutation = useMutation({
    mutationFn: () => getVerificationStatsService(),
  })
  const getSubmissionDetailMutation = useMutation({
    mutationFn: (args: {
      id: string | number | undefined
      userRole?: string | null
    }) => getSubmissionDetailService(args.id, args.userRole),
  })
  const submitRecordForVerificationMutation = useMutation({
    mutationFn: (payload: { record_id: string }) =>
      submitRecordForVerificationService(payload),
  })
  const verifySubmissionMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string | number | undefined; remarks: string }) =>
      verifySubmissionService(id, remarks),
  })
  const rejectSubmissionMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string | number | undefined; remarks: string }) =>
      rejectSubmissionService(id, remarks),
  })
  const getNotificationsMutation = useMutation({
    mutationFn: () => getNotificationsService(),
  })
  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId: string | number) => markNotificationReadService(notificationId),
  })
  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => markAllNotificationsReadService(),
  })
  const getAuditLogsMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getAuditLogsService(filters),
  })

  return {
    getPendingSubmissions: getPendingSubmissionsMutation.mutateAsync,
    getVerificationStats: getVerificationStatsMutation.mutateAsync,
    getSubmissionDetail: (
      id: string | number | undefined,
      userRole?: string | null,
    ) => getSubmissionDetailMutation.mutateAsync({ id, userRole }),
    submitRecordForVerification: submitRecordForVerificationMutation.mutateAsync,
    verifySubmission: (id: string | number | undefined, remarks: string) =>
      verifySubmissionMutation.mutateAsync({ id, remarks }),
    rejectSubmission: (id: string | number | undefined, remarks: string) =>
      rejectSubmissionMutation.mutateAsync({ id, remarks }),
    getNotifications: getNotificationsMutation.mutateAsync,
    markNotificationRead: markNotificationReadMutation.mutateAsync,
    markAllNotificationsRead: markAllNotificationsReadMutation.mutateAsync,
    getAuditLogs: getAuditLogsMutation.mutateAsync,
  }
}

