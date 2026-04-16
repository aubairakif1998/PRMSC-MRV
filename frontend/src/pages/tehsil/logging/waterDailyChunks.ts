import type { WaterDailyRangeDay } from "./loggingComplianceTypes";

/** Up to seven days per chunk, in API order (chronological). */
export function chunkDaysByWeek(days: WaterDailyRangeDay[]): WaterDailyRangeDay[][] {
  const chunks: WaterDailyRangeDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    chunks.push(days.slice(i, i + 7));
  }
  return chunks;
}
