import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import DataGrid from "@/components/DataGrid";
import { Card, CardContent } from "@/components/ui/card";
import DataGridSkeleton, {
  ExecutiveKpiCardsSkeleton,
} from "@/components/DataGridSkeleton";
import { useProgramDashboardApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import {
  useWaterAnalysisColumns,
  waterSystemDetailFields,
} from "./executiveAnalysisColumns";
import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";

function RowDetailsPanel({ row }: { row: WaterSystemDetailRow }) {
  const fields = useMemo(() => waterSystemDetailFields(row), [row]);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        System detail breakdown
      </p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label} className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {f.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const MemoRowDetails = memo(RowDetailsPanel);

const ExecutiveWaterAnalysis = () => {
  const { getDashboardWaterSystemsDetail } = useProgramDashboardApi();
  const scope = useExecutiveScopeFilters();
  const columns = useWaterAnalysisColumns();

  const [rows, setRows] = useState<WaterSystemDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getDashboardWaterSystemsDetail(scope.apiFilters);
        if (!cancelled) {
          setRows((data?.rows ?? []) as WaterSystemDetailRow[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load water system analysis"));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [scope.apiFilters, getDashboardWaterSystemsDetail]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        water: acc.water + (r.total_water_pumped_m3 ?? 0),
        hours: acc.hours + (r.total_pump_hours_h ?? 0),
      }),
      { water: 0, hours: 0 },
    );
  }, [rows]);

  const renderRowDetails = useCallback(
    (row: WaterSystemDetailRow) => <MemoRowDetails row={row} />,
    [],
  );

  const getRowId = useCallback((row: WaterSystemDetailRow) => row.water_system_id, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Droplets className="size-5 text-blue-600" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Water system analysis
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Per-system water metrics from bulk-meter logs. Total pumped is the sum of
          interval volumes (each log: stop reading minus previous stop). Latest meter
          is the cumulative reading at the most recent log — not a sum of readings.
        </p>
      </div>

      <ExecutiveScopeFiltersCard
        filters={scope.filters}
        activeScopeLabel={scope.activeScopeLabel}
        allowedTehsils={scope.allowedTehsils}
        restrictTehsils={scope.restrictTehsils}
        villageOptions={scope.villageOptions}
        onUpdate={scope.updateFilter}
        onApply={scope.applyFilters}
      />

      {loading ? (
        <div className="space-y-4">
          <ExecutiveKpiCardsSkeleton count={3} />
          <DataGridSkeleton rows={10} columns={8} />
        </div>
      ) : (
        <>
          {error ? (
            <Card>
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Systems in scope</p>
                    <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total pumped (intervals)</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totals.water.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total pump runtime</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totals.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h
                    </p>
                  </CardContent>
                </Card>
              </div>

              <DataGrid
                title="Water systems registry"
                description="Interval sums and cumulative meter readings per system (rejected logs excluded)."
                rows={rows}
                columns={columns}
                exportFileName={`water-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
                getRowId={getRowId}
                renderRowDetails={renderRowDetails}
                initialPageSize={25}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ExecutiveWaterAnalysis;
