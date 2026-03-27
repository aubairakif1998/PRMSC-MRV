import api from '../api/api'
import { buildQueryString, type AnyRecord, type QueryFilters } from './types'

export const createWaterSystem = async (formData: AnyRecord) => {
  const response = await api.post('/operator/water-system', formData)
  return response.data
}

export const submitWaterMonthlyData = async (formData: AnyRecord) => {
  const response = await api.post('/operator/water-data', formData)
  return response.data
}

export const getWaterSystemConfig = async (tehsil: string, village: string, settlement: string) => {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString()
  const response = await api.get(`/operator/water-system-config?${params}`)
  return response.data
}

export const getWaterSystems = async () => {
  const response = await api.get('/operator/water-systems')
  return response.data
}

export const getSolarSystemConfig = async (tehsil: string, village: string, settlement: string) => {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString()
  const response = await api.get(`/operator/solar-system-config?${params}`)
  return response.data
}

export const downloadWaterReportPDF = async (systemId: string | number, year: string | number) => {
  const response = await api.get(`/operator/water-report-pdf/${systemId}/${year}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `water_report_${systemId}_${year}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const createSolarSystem = async (formData: AnyRecord) => {
  const response = await api.post('/operator/solar-system', formData)
  return response.data
}

export const submitSolarMonthlyData = async (formData: AnyRecord) => {
  const response = await api.post('/operator/solar-data', formData)
  return response.data
}

export const uploadImage = async (file: File, recordId: string | number, recordType: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('record_id', String(recordId))
  formData.append('record_type', recordType)
  const response = await api.post('/operator/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data as AnyRecord
}

export const getMySubmissions = async (status?: string) => {
  const params = status ? `?status=${encodeURIComponent(status)}` : ''
  const response = await api.get(`/verification/my-submissions${params}`)
  return response.data
}

export const getDashboardProgramSummary = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/dashboard/program-summary${buildQueryString(filters)}`)
  return response.data
}

export const getDashboardWaterSupplied = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/dashboard/water-supplied${buildQueryString(filters)}`)
  return response.data
}

export const getDashboardPumpHours = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/dashboard/pump-hours${buildQueryString(filters)}`)
  return response.data
}

export const getDashboardSolarGeneration = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/dashboard/solar-generation${buildQueryString(filters)}`)
  return response.data
}

export const getDashboardGridImport = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/dashboard/grid-import${buildQueryString(filters)}`)
  return response.data
}

export const getWaterDrafts = async () => {
  const response = await api.get('/operator/water-data/drafts')
  return response.data
}

export const getSolarDrafts = async () => {
  const response = await api.get('/operator/solar-data/drafts')
  return response.data
}

export const getWaterDraft = async (draftId: string | number) => {
  const response = await api.get(`/operator/water-data/draft/${draftId}`)
  return response.data
}

export const getSolarDraft = async (draftId: string | number) => {
  const response = await api.get(`/operator/solar-data/draft/${draftId}`)
  return response.data
}

export const submitWaterDraft = async (draftId: string | number) => {
  const response = await api.post(`/operator/water-data/draft/${draftId}/submit`)
  return response.data
}

export const submitSolarDraft = async (draftId: string | number) => {
  const response = await api.post(`/operator/solar-data/draft/${draftId}/submit`)
  return response.data
}

export const deleteWaterDraft = async (draftId: string | number) => {
  const response = await api.delete(`/operator/water-data/draft/${draftId}`)
  return response.data
}

export const deleteSolarDraft = async (draftId: string | number) => {
  const response = await api.delete(`/operator/solar-data/draft/${draftId}`)
  return response.data
}

export const deleteWaterSystem = async (systemId: string | number) => {
  const response = await api.delete(`/operator/water-system/${systemId}`)
  return response.data
}

export const deleteSolarSystem = async (systemId: string | number) => {
  const response = await api.delete(`/operator/solar-system/${systemId}`)
  return response.data
}

export const getSolarSystems = async () => {
  const response = await api.get('/operator/solar-systems')
  return response.data
}

export const getWaterSupplyData = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/operator/water-supply-data${buildQueryString(filters)}`)
  return response.data
}

export const saveWaterSupplyData = async (payload: AnyRecord) => {
  const response = await api.post('/operator/water-supply-data', payload)
  return response.data
}

export const saveWaterBulkData = async (payload: AnyRecord) => {
  const response = await api.post('/operator/water-data/bulk', payload)
  return response.data
}

export const getSolarSupplyData = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/operator/solar-supply-data${buildQueryString(filters)}`)
  return response.data
}

export const saveSolarSupplyData = async (payload: AnyRecord) => {
  const response = await api.post('/operator/solar-supply-data', payload)
  return response.data
}

export const saveSolarBulkData = async (payload: AnyRecord) => {
  const response = await api.post('/operator/solar-data/bulk', payload)
  return response.data
}

