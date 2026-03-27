import api from '../api/api'
import { buildQueryString, type QueryFilters } from './types'

export const submitRecordForVerification = async (payload: {
  submission_type: 'water_system' | 'solar_system'
  record_id: string
}) => {
  const response = await api.post('/verification/submit', payload)
  return response.data
}

export const getPendingSubmissions = async () => {
  const response = await api.get('/verification/pending')
  return response.data
}

export const getVerificationStats = async () => {
  const response = await api.get('/verification/stats')
  return response.data
}

export const getSubmissionDetail = async (id: string | number | undefined) => {
  const response = await api.get(`/verification/${id}`)
  return response.data
}

export const verifySubmission = async (id: string | number | undefined, remarks: string) => {
  const response = await api.post(`/verification/${id}/verify`, { remarks })
  return response.data
}

export const rejectSubmission = async (id: string | number | undefined, remarks: string) => {
  const response = await api.post(`/verification/${id}/reject`, { remarks })
  return response.data
}

export const approveSubmission = async (id: string | number | undefined, remarks: string) => {
  const response = await api.post(`/verification/${id}/approve`, { remarks })
  return response.data
}

export const getNotifications = async () => {
  const response = await api.get('/verification/notifications')
  return response.data
}

export const markNotificationRead = async (notificationId: string | number) => {
  const response = await api.post(`/verification/notifications/${notificationId}/read`)
  return response.data
}

export const markAllNotificationsRead = async () => {
  const response = await api.post('/verification/notifications/read-all')
  return response.data
}

export const getAuditLogs = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/verification/audit-logs${buildQueryString(filters)}`)
  return response.data
}

