import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Sun } from "lucide-react";
import DataGrid from "@/components/DataGrid";
import { Card, CardContent } from "@/components/ui/card";
import DataGridSkeleton, {
  ExecutiveKpiCardsSkeleton,
} from "@/components/DataGridSkeleton";
import { useProgramDashboardApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import ExecutiveScopeFiltersCard from "./ExecutiveScopeFiltersCard";
import {
  solarSystemDetailFields,
  useSolarAnalysisColumns,
} from "./executiveAnalysisColumns";
import type { SolarSystemDetailRow } from "./executiveAnalysisTypes";
import { useExecutiveScopeFilters } from "./useExecutiveScopeFilters";

function RowDetailsPanel({ row }: { row: SolarSystemDetailRow }) {
  const fields = useMemo(() => solarSystemDetailFields(row), [row]);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Solar site energy breakdown
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

const ExecutiveSolarAnalysis = () => {
  const { getDashboardSolarSystemsDetail } = useProgramDashboardApi();
  const scope = useExecutiveScopeFilters();
  const columns = useSolarAnalysisColumns();

  const [rows, setRows] = useState<SolarSystemDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getDashboardSolarSystemsDetail(scope.apiFilters);
        if (!cancelled) {
          setRows((data?.rows ?? []) as SolarSystemDetailRow[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load solar system analysis"));
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
  }, [scope.apiFilters, getDashboardSolarSystemsDetail]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        export: acc.export + (r.total_export_kwh ?? 0),
        import: acc.import + (r.total_import_kwh ?? 0),
        net: acc.net + (r.total_net_kwh ?? 0),
      }),
      { export: 0, import: 0, net: 0 },
    );
  }, [rows]);

  const renderRowDetails = useCallback(
    (row: SolarSystemDetailRow) => <MemoRowDetails row={row} />,
    [],
  );

  const getRowId = useCallback((row: SolarSystemDetailRow) => row.solar_system_id, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sun className="size-5 text-amber-600" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Solar system analysis
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Per-site export, import, and net energy from monthly records. Expand any
          row for full metrics and export filtered data to Excel.
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
          <ExecutiveKpiCardsSkeleton count={4} />
          <DataGridSkeleton rows={10} columns={9} />
        </div>
      ) : (
        <>
          {error ? (
            <Card>
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Sites in scope</p>
                    <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total export</p>
                    <p className="text-2xl font-semibold tabular-nums text-amber-700">
                      {totals.export.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total import</p>
                    <p className="text-2xl font-semibold tabular-nums text-red-700">
                      {totals.import.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total net</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totals.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
                    </p>
                  </CardContent>
                </Card>
              </div>

              <DataGrid
                title="Solar sites registry"
                description="Monthly log aggregates per solar system (export, import, net)."
                rows={rows}
                columns={columns}
                exportFileName={`solar-systems-${scope.activeFilters.year}-${scope.activeFilters.tehsil}`}
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

export default ExecutiveSolarAnalysis;
