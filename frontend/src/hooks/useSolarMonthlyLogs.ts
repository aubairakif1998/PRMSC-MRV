import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../lib/api-error";
import {
  getSolarSupplyData,
  getSolarSystems,
} from "../services/tehsilManagerOperatorService";
import type {
  SolarMonthlyLogTableRow,
  SolarMonthlySupplyListItem,
  SolarSystemRow,
} from "../types/api";

function monthOrder(a: SolarMonthlyLogTableRow, b: SolarMonthlyLogTableRow): number {
  const loc =
    `${a.tehsil}\0${a.village}\0${a.settlement}`.localeCompare(
      `${b.tehsil}\0${b.village}\0${b.settlement}`,
      undefined,
      { sensitivity: "base" },
    );
  if (loc !== 0) return loc;
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/**
 * Loads monthly solar supply rows for every registered solar site for the given calendar year.
 * Uses the service layer directly so effects only re-run when `year` changes (no hook identity churn).
 */
export function useSolarMonthlyLogs(year: number) {
  const [rows, setRows] = useState<SolarMonthlyLogTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sitesRaw = await getSolarSystems();
      const sites = (Array.isArray(sitesRaw) ? sitesRaw : []) as SolarSystemRow[];
      const chunks = await Promise.all(
        sites.map(async (site) => {
          try {
            const data = await getSolarSupplyData({
              tehsil: site.tehsil,
              village: site.village,
              settlement: site.settlement ?? "",
              year,
            });
            const list = (Array.isArray(data) ? data : []) as SolarMonthlySupplyListItem[];
            return list.map(
              (r): SolarMonthlyLogTableRow => ({
                ...r,
                solar_system_id: site.id,
                tehsil: site.tehsil,
                village: site.village,
                settlement: (site.settlement ?? "").trim(),
              }),
            );
          } catch {
            return [] as SolarMonthlyLogTableRow[];
          }
        }),
      );
      setRows(chunks.flat().sort(monthOrder));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Could not load monthly solar logs"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, refetch: load };
}
