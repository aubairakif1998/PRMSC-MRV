import { useCallback, useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { CalendarClock, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getLoggingCompliance } from "../../../services/tehsilManagerOperatorService";
import type { CompliancePayload } from "./loggingComplianceTypes";
import WaterLoggingComplianceSection from "./WaterLoggingComplianceSection";

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WaterLoggingCompliancePage() {
  const baseId = useId();
  const panelId = `${baseId}-water-panel`;

  const [waterDate, setWaterDate] = useState(todayIsoDate);
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const raw = await getLoggingCompliance({
        water_date: waterDate,
        solar_year: now.getFullYear(),
        solar_month: now.getMonth() + 1,
      });
      setData(raw as CompliancePayload);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load water logging status"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [waterDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const waterStats = useMemo(() => {
    const rows = data?.water_systems ?? [];
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const k = r.daily_status;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [data?.water_systems]);

  return (
    <div className="w-full max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarClock className="size-7 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Water logging status
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Check whether tubewell operators have entered daily water logs for
              each water system on a specific day.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="default"
          className="shrink-0 gap-2 self-start"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          Load / refresh
        </Button>
      </div>

      <Alert variant="info">
        <AlertDescription className="text-sm leading-relaxed">
          Operators should submit one log per site per day. Pick a day to see
          missing, draft, and submitted/approved entries.
        </AlertDescription>
      </Alert>

      <WaterLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        waterDate={waterDate}
        setWaterDate={setWaterDate}
        loading={loading}
        data={data}
        waterStats={waterStats}
        onReload={() => void load()}
      />
    </div>
  );
}

