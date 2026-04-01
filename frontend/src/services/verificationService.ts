import api from '../api/api'
import { isTubewellOperator } from '../constants/roles'
import { buildQueryString, type QueryFilters } from './types'

export const submitRecordForVerification = async (payload: { record_id: string }) => {
  const response = await api.post('/operator/submit', payload)
  return response.data
}

export const getPendingSubmissions = async () => {
  const response = await api.get('/operator/verification/pending')
  return response.data
}

export const getVerificationStats = async () => {
  const response = await api.get('/operator/verification/stats')
  return response.data
}

export const getSubmissionDetail = async (
  id: string | number | undefined,
  userRole?: string | null,
) => {
  if (id === undefined || id === null || id === '') {
    throw new Error('Submission id is required')
  }
  const path = isTubewellOperator(userRole)
    ? `/operator/tubewell/submission/${id}`
    : `/operator/tehsil-manager/submission/${id}`
  const response = await api.get(path)
  return response.data
}

export const verifySubmission = async (id: string | number | undefined, remarks: string) => {
  const response = await api.post(`/operator/verification/${id}/verify`, { remarks })
  return response.data
}

export const rejectSubmission = async (id: string | number | undefined, remarks: string) => {
  const response = await api.post(`/operator/verification/${id}/reject`, { remarks })
  return response.data
}

export const getNotifications = async () => {
  const response = await api.get('/operator/notifications')
  return response.data
}

export const markNotificationRead = async (notificationId: string | number) => {
  const response = await api.post(`/operator/notifications/${notificationId}/read`)
  return response.data
}

export const markAllNotificationsRead = async () => {
  const response = await api.post('/operator/notifications/read-all')
  return response.data
}

export const getAuditLogs = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/operator/verification/audit-logs${buildQueryString(filters)}`)
  return response.data
}

