import { useCallback, useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { Download, Loader2, RefreshCcw, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getSolarMonthlyYearRange,
  getSolarSystems,
} from "../../../services/tehsilManagerOperatorService";
import type {
  SolarMonthlyYearPayload,
  SolarSystemListItem,
} from "./loggingComplianceTypes";
import { downloadSolarComplianceExcel } from "./exportComplianceExcel";
import SolarLoggingComplianceSection from "./SolarLoggingComplianceSection";

export default function SolarLoggingCompliancePage() {
  const baseId = useId();
  const panelId = `${baseId}-solar-panel`;

  const [solarSites, setSolarSites] = useState<SolarSystemListItem[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSolarSystemId, setSelectedSolarSystemId] = useState("");
  const [solarYear, setSolarYear] = useState(() => new Date().getFullYear());
  const [yearData, setYearData] = useState<SolarMonthlyYearPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => y - 4 + i);
  }, []);

  const loadSites = useCallback(async () => {
    try {
      setSitesLoading(true);
      const raw = await getSolarSystems();
      const list = Array.isArray(raw) ? (raw as SolarSystemListItem[]) : [];
      setSolarSites(list);
      setSelectedSolarSystemId((prev) =>
        prev && list.some((s) => s.id === prev) ? prev : "",
      );
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load solar sites"));
      setSolarSites([]);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  const loadYear = useCallback(async () => {
    if (!selectedSolarSystemId) {
      setYearData(null);
      return;
    }
    try {
      setLoading(true);
      const raw = await getSolarMonthlyYearRange({
        solar_system_id: selectedSolarSystemId,
        year: solarYear,
      });
      setYearData(raw);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Failed to load monthly solar logging"),
      );
      setYearData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSolarSystemId, solarYear]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadYear();
  }, [loadYear]);

  return (
    <div className="w-full max-w-7xl space-y-8 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <Sun className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Compliance
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Monthly solar logging
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Select a PV site and calendar year to review all twelve months in
              one place.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!yearData || loading || !selectedSolarSystemId}
            onClick={() => {
              if (yearData) downloadSolarComplianceExcel(yearData);
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
            disabled={loading || sitesLoading || !selectedSolarSystemId}
            onClick={() => void loadYear()}
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

      <SolarLoggingComplianceSection
        baseId={baseId}
        panelId={panelId}
        solarSites={solarSites}
        sitesLoading={sitesLoading}
        selectedSolarSystemId={selectedSolarSystemId}
        onSelectSolarSystem={setSelectedSolarSystemId}
        solarYear={solarYear}
        onSolarYearChange={setSolarYear}
        yearOptions={yearOptions}
        loading={loading}
        yearData={yearData}
      />
    </div>
  );
}
