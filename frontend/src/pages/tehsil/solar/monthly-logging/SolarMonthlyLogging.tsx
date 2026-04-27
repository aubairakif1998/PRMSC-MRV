import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarRange,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../../components/ui/native-select";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { tehsilRoutes } from "../../../../constants/routes";
import { useSolarMonthlyLogs, useTehsilManagerOperatorApi } from "../../../../hooks";
import { getApiErrorMessage } from "../../../../lib/api-error";
import type { SolarMonthlyLogTableRow } from "../../../../types/api";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

export default function SolarMonthlyLogging() {
  const navigate = useNavigate();
  const location = useLocation();
  const [year, setYear] = useState(currentYear);
  const { rows, loading, error, refetch } = useSolarMonthlyLogs(year);
  const { deleteSolarSupplyRecord } = useTehsilManagerOperatorApi();

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SolarMonthlyLogTableRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const monthLabel = MONTH_NAMES[r.month] ?? String(r.month);
      const blob = [
        r.tehsil,
        r.village,
        r.settlement,
        String(r.year),
        monthLabel,
        String(r.month),
        r.remarks ?? "",
        r.id,
        r.solar_system_id,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success("Logs refreshed");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Refresh failed"));
    } finally {
      setRefreshing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSolarSupplyRecord(deleteTarget.id);
      toast.success("Monthly record deleted");
      setDeleteTarget(null);
      await refetch();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Solar Monthly Logging
            </h1>
            <p className="text-sm text-muted-foreground">
              All monthly grid import/export entries for your registered solar
              sites, by calendar year.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sml-year" className="text-xs">
                Year
              </Label>
              <NativeSelect
                id="sml-year"
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-[120px]"
              >
                {YEAR_OPTIONS.map((y) => (
                  <NativeSelectOption key={y} value={String(y)}>
                    {y}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button
              variant="outline"
              onClick={() => void onRefresh()}
              disabled={refreshing || loading}
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(tehsilRoutes.solarEnergyAdd, {
                  state: { from: `${location.pathname}${location.search}` },
                })
              }
              className="gap-2"
            >
              <Plus className="size-4" />
              Add monthly log
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-6 text-sm text-amber-900">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-col gap-2 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarRange className="size-4" />
              </div>
              <div>
                <CardTitle>Monthly records</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      Loading monthly logs…
                    </>
                  ) : (
                    `${filtered.length} row(s) for ${year}`
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by location, month, remarks, ID…"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-11 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Tehsil</TableHead>
                        <TableHead>Village</TableHead>
                        <TableHead>Settlement</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Import off-peak</TableHead>
                        <TableHead className="text-right">Import peak</TableHead>
                        <TableHead className="text-right">Export off-peak</TableHead>
                        <TableHead className="text-right">Export peak</TableHead>
                        <TableHead className="text-right">Net off-peak</TableHead>
                        <TableHead className="text-right">Net peak</TableHead>
                        <TableHead className="min-w-[140px]">Remarks</TableHead>
                        <TableHead>Bill</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="sticky right-0 z-20 min-w-[180px] bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={16}
                            className="h-28 text-center text-muted-foreground"
                          >
                            No monthly logs for {year}. Use{" "}
                            <span className="font-medium text-foreground">
                              Add monthly log
                            </span>{" "}
                            to enter data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.tehsil}
                            </TableCell>
                            <TableCell>{r.village}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.settlement || "—"}
                            </TableCell>
                            <TableCell>{r.year}</TableCell>
                            <TableCell>
                              {MONTH_NAMES[r.month] ?? r.month}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.import_off_peak)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.import_peak)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.export_off_peak)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.export_peak)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.net_off_peak)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(r.net_peak)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={r.remarks ?? ""}>
                              {r.remarks?.trim() ? r.remarks : "—"}
                            </TableCell>
                            <TableCell>
                              {r.electricity_bill_image_url?.trim() ? (
                                <a
                                  href={r.electricity_bill_image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  View
                                  <ExternalLink className="size-3.5" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(r.created_at)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(r.updated_at)}
                            </TableCell>
                            <TableCell className="sticky right-0 z-10 min-w-[180px] bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)]">
                              <div className="inline-flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() =>
                                    navigate(tehsilRoutes.solarMonthlyLogEdit(r.id), {
                                      state: {
                                        from: `${location.pathname}${location.search}`,
                                      },
                                    })
                                  }
                                >
                                  <Pencil className="size-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteTarget(r)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete monthly log?</DialogTitle>
            <DialogDescription>
              This removes the record for{" "}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? `${MONTH_NAMES[deleteTarget.month] ?? deleteTarget.month} ${deleteTarget.year}`
                  : ""}
              </span>{" "}
              at {deleteTarget?.village}
              {deleteTarget?.settlement
                ? ` · ${deleteTarget.settlement}`
                : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
