import { useCallback, useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { Download, Droplets, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getWaterDailyLoggingRange,
  getWaterSystems,
} from "../../../services/tehsilManagerOperatorService";
import type {
  WaterDailyRangePayload,
  WaterSystemListItem,
} from "./loggingComplianceTypes";
import { downloadWaterComplianceExcel } from "./exportComplianceExcel";
import WaterLoggingComplianceSection from "./WaterLoggingComplianceSection";
import { chunkDaysByWeek } from "./waterDailyChunks";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last N calendar days ending today (inclusive). */
function rangeForLastNDays(n: number): { date_from: string; date_to: string } {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));
  return { date_from: isoDateLocal(start), date_to: isoDateLocal(end) };
}

export default function WaterLoggingCompliancePage() {
  const baseId = useId();
  const panelId = `${baseId}-water-panel`;

  const [waterSystems, setWaterSystems] = useState<WaterSystemListItem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [selectedWaterSystemId, setSelectedWaterSystemId] = useState("");
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [rangeData, setRangeData] = useState<WaterDailyRangePayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const weekChunks = useMemo(
    () => chunkDaysByWeek(rangeData?.days ?? []),
    [rangeData?.days],
  );

  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  useEffect(() => {
    if (weekChunks.length === 0) {
      setActiveWeekIndex(0);
      return;
    }
    setActiveWeekIndex(weekChunks.length - 1);
  }, [
    rangeData?.date_from,
    rangeData?.date_to,
    rangeData?.water_system_id,
    weekChunks.length,
  ]);

  const visibleDays = weekChunks[activeWeekIndex] ?? [];

  const loadSystems = useCallback(async () => {
    try {
      setSystemsLoading(true);
      const raw = await getWaterSystems();
      const list = Array.isArray(raw) ? (raw as WaterSystemListItem[]) : [];
      setWaterSystems(list);
      setSelectedWaterSystemId((prev) =>
        prev && list.some((s) => s.id === prev) ? prev : "",
      );
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load water systems"));
      setWaterSystems([]);
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  const loadRange = useCallback(async () => {
    if (!selectedWaterSystemId) {
      setRangeData(null);
      return;
    }
    const { date_from, date_to } = rangeForLastNDays(rangeDays);
    try {
      setLoading(true);
      const raw = await getWaterDailyLoggingRange({
        water_system_id: selectedWaterSystemId,
        date_from,
        date_to,
      });
      setRangeData(raw);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Failed to load daily logging for this system"),
      );
      setRangeData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedWaterSystemId, rangeDays]);

  useEffect(() => {
    void loadSystems();
  }, [loadSystems]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  return (
    <div className="w-full max-w-7xl space-y-8 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <Droplets className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Compliance
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Daily water logging
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Select a water system, then choose how many recent days to load.
              Longer windows are split into week-sized segments like the table.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={
              !rangeData || loading || !selectedWaterSystemId || visibleDays.length === 0
            }
            onClick={() => {
              if (!rangeData) return;
              const options =
                weekChunks.length > 1
                  ? {
                      tableDays: visibleDays,
                      segmentIndex: activeWeekIndex + 1,
                      segmentCount: weekChunks.length,
                    }
                  : { tableDays: visibleDays };
              downloadWaterComplianceExcel(rangeData, options);
            }}
          >
            <Download className="size-4" aria-hidden />
            Export Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading || systemsLoading || !selectedWaterSystemId}
            onClick={() => void loadRange()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </header>

      <WaterLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        waterSystems={waterSystems}
        systemsLoading={systemsLoading}
        selectedWaterSystemId={selectedWaterSystemId}
        onSelectWaterSystem={setSelectedWaterSystemId}
        rangeDays={rangeDays}
        onRangeDaysChange={setRangeDays}
        loading={loading}
        rangeData={rangeData}
        weekChunks={weekChunks}
        activeWeekIndex={activeWeekIndex}
        onActiveWeekIndexChange={setActiveWeekIndex}
        visibleDays={visibleDays}
      />
    </div>
  );
}
