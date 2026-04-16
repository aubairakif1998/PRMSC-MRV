import { useCallback, useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { CalendarClock, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getLoggingCompliance } from "../../../services/tehsilManagerOperatorService";
import SolarLoggingComplianceSection from "./SolarLoggingComplianceSection";
import { MONTH_NAMES, type CompliancePayload } from "./loggingComplianceTypes";

export default function SolarLoggingCompliancePage() {
  const baseId = useId();
  const panelId = `${baseId}-solar-panel`;

  const now = new Date();
  const [solarYear, setSolarYear] = useState(now.getFullYear());
  const [solarMonth, setSolarMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getLoggingCompliance({
        // still required by API; not used on this page
        water_date: `${solarYear}-${String(solarMonth).padStart(2, "0")}-01`,
        solar_year: solarYear,
        solar_month: solarMonth,
      });
      setData(raw as CompliancePayload);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load solar logging status"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [solarYear, solarMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => y - 4 + i);
  }, []);

  const solarStats = useMemo(() => {
    const rows = data?.solar_systems ?? [];
    let logged = 0;
    let missing = 0;
    for (const r of rows) {
      if (r.monthly_status === "logged") logged += 1;
      else missing += 1;
    }
    return { logged, missing, total: rows.length };
  }, [data?.solar_systems]);

  return (
    <div className="w-full max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary/15">
            <CalendarClock className="size-7 text-secondary" />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Solar logging status
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Track which solar sites have monthly electricity figures saved for{" "}
              {MONTH_NAMES[solarMonth]} {solarYear}.
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
          Solar logging is once per month per site. Choose the period and review
          which sites are still missing that month&apos;s entry.
        </AlertDescription>
      </Alert>

      <SolarLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        solarYear={solarYear}
        setSolarYear={setSolarYear}
        solarMonth={solarMonth}
        setSolarMonth={setSolarMonth}
        yearOptions={yearOptions}
        loading={loading}
        data={data}
        solarStats={solarStats}
        onReload={() => void load()}
      />
    </div>
  );
}

