import { useMutation } from '@tanstack/react-query'
import {
  approveSubmission as approveSubmissionService,
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
    mutationFn: (id: string | number | undefined) => getSubmissionDetailService(id),
  })
  const submitRecordForVerificationMutation = useMutation({
    mutationFn: (payload: { submission_type: 'water_system' | 'solar_system'; record_id: string }) =>
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
  const approveSubmissionMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string | number | undefined; remarks: string }) =>
      approveSubmissionService(id, remarks),
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
    getSubmissionDetail: getSubmissionDetailMutation.mutateAsync,
    submitRecordForVerification: submitRecordForVerificationMutation.mutateAsync,
    verifySubmission: (id: string | number | undefined, remarks: string) =>
      verifySubmissionMutation.mutateAsync({ id, remarks }),
    rejectSubmission: (id: string | number | undefined, remarks: string) =>
      rejectSubmissionMutation.mutateAsync({ id, remarks }),
    approveSubmission: (id: string | number | undefined, remarks: string) =>
      approveSubmissionMutation.mutateAsync({ id, remarks }),
    getNotifications: getNotificationsMutation.mutateAsync,
    markNotificationRead: markNotificationReadMutation.mutateAsync,
    markAllNotificationsRead: markAllNotificationsReadMutation.mutateAsync,
    getAuditLogs: getAuditLogsMutation.mutateAsync,
  }
}

