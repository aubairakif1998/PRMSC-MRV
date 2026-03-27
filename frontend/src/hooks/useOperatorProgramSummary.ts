import { useQuery } from '@tanstack/react-query'

import { getDashboardProgramSummary } from '../services/operatorService'

export type ProgramSummary = {
  ohr_count: number
  solar_facilities: number
  bulk_meters: number
}

export type OperatorFilters = {
  tehsil?: string
  village?: string
  month?: string | number
  year?: number
}

export function useOperatorProgramSummary(filters: OperatorFilters) {
  return useQuery({
    queryKey: ['operator', 'program-summary', filters],
    queryFn: async () => (await getDashboardProgramSummary(filters)) as ProgramSummary,
  })
}

