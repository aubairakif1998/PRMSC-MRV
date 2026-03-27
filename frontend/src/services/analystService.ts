import api from '../api/api'
import { buildQueryString, type QueryFilters } from './types'

export const getDashboardStats = async (filters: Record<string, string> = {}) => {
  const params = new URLSearchParams(filters).toString()
  const response = await api.get(`/analyst/dashboard/stats${params ? `?${params}` : ''}`)
  return response.data
}

export const getDashboardCharts = async () => {
  const response = await api.get('/analyst/dashboard/charts')
  return response.data
}

export const getSubmissions = async () => {
  const response = await api.get('/analyst/submissions')
  return response.data
}

export const getEmissionsSummary = async (year?: number) => {
  const params = year ? `?year=${year}` : ''
  const response = await api.get(`/emissions/summary${params}`)
  return response.data
}

export const getEmissionsTrend = async (year?: number) => {
  const params = year ? `?year=${year}` : ''
  const response = await api.get(`/emissions/monthly-trend${params}`)
  return response.data
}

export const getSystemComparison = async (year?: number) => {
  const params = year ? `?year=${year}` : ''
  const response = await api.get(`/emissions/system-comparison${params}`)
  return response.data
}

export const calculateEmissions = async (payload: Record<string, unknown>) => {
  const response = await api.post('/emissions/calculate', payload)
  return response.data
}

export const getEmissionAudit = async (resultId: string | number) => {
  const response = await api.get(`/emissions/audit/${resultId}`)
  return response.data
}

export const getPredictionLocations = async () => {
  const response = await api.get('/predictions/locations')
  return response.data
}

export const getWaterDemandPredictions = async (payload: Record<string, unknown>) => {
  const response = await api.post('/predictions/water-demand', payload)
  return response.data
}

export const getSolarGenerationPredictions = async (payload: Record<string, unknown>) => {
  const response = await api.post('/predictions/solar-generation', payload)
  return response.data
}

export const getGridConsumptionPredictions = async (payload: Record<string, unknown>) => {
  const response = await api.post('/predictions/grid-consumption', payload)
  return response.data
}

export const getAllPredictions = async (payload: Record<string, unknown>) => {
  const response = await api.post('/predictions/all', payload)
  return response.data
}

export const trainPredictionModels = async (payload: Record<string, unknown>) => {
  const response = await api.post('/predictions/train', payload)
  return response.data
}

export const getVerificationAuditLogs = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/verification/audit-logs${buildQueryString(filters)}`)
  return response.data
}

