import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Pencil, Plus, RefreshCcw, Search } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import type { WaterSystemRow } from "../../../types/api";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const kv = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

export default function WaterSystems() {
  const navigate = useNavigate();
  const { getWaterSystems, getWaterSystem } = useTehsilManagerOperatorApi();

  const [systems, setSystems] = useState<WaterSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSystem, setDetailSystem] = useState<WaterSystemRow | null>(null);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = await getWaterSystems();
      setSystems(Array.isArray(data) ? (data as WaterSystemRow[]) : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load water systems"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) => {
      return (
        s.tehsil?.toLowerCase().includes(q) ||
        s.village?.toLowerCase().includes(q) ||
        (s.settlement ?? "").toLowerCase().includes(q) ||
        (s.unique_identifier ?? "").toLowerCase().includes(q) ||
        (s.pump_model ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [systems, search]);

  const openDetails = async (s: WaterSystemRow) => {
    setDetailSystem(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = (await getWaterSystem(s.id)) as WaterSystemRow;
      setDetailSystem(detail);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load system details"));
    } finally {
      setDetailLoading(false);
    }
  };

  const goToEdit = (s: WaterSystemRow) => {
    if (!s.unique_identifier) {
      toast.error("This water system has no UID; cannot open edit screen.");
      return;
    }
    navigate(tehsilRoutes.waterFormEdit(s.unique_identifier));
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Water systems</h1>
            <p className="text-sm text-muted-foreground">
              View and manage registered water systems in your tehsil scope.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => navigate(tehsilRoutes.waterForm)}
              className="gap-2"
            >
              <Plus className="size-4" />
              Register water system
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All systems</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} system(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tehsil, village, UID, model, or ID…"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tehsil</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead>Settlement</TableHead>
                      <TableHead>UID</TableHead>
                      <TableHead>Pump model</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No water systems found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{kv(s.tehsil)}</TableCell>
                          <TableCell>{kv(s.village)}</TableCell>
                          <TableCell>{kv(s.settlement)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {kv(s.unique_identifier)}
                          </TableCell>
                          <TableCell>{kv(s.pump_model)}</TableCell>
                          <TableCell>{formatDate(s.created_at)}</TableCell>
                          <TableCell>{formatDate(s.updated_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void openDetails(s)}
                              >
                                <Eye className="size-4" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => goToEdit(s)}
                                className="gap-1.5"
                              >
                                <Pencil className="size-4" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) {
            setDetailSystem(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Water system details</DialogTitle>
            <DialogDescription>
              {detailSystem
                ? `${detailSystem.tehsil} • ${detailSystem.village}${detailSystem.settlement ? ` • ${detailSystem.settlement}` : ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detailSystem ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">System ID</span>
                    <span className="font-mono text-xs">{detailSystem.id}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">UID</span>
                    <span className="font-mono text-xs">
                      {kv(detailSystem.unique_identifier)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(detailSystem.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(detailSystem.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {detailLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-4 w-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Pump model</span>
                        <span>{kv(detailSystem.pump_model)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Pump serial</span>
                        <span>{kv(detailSystem.pump_serial_number)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Flow rate</span>
                        <span>{kv(detailSystem.pump_flow_rate)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Meter model</span>
                        <span>{kv(detailSystem.meter_model)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Meter serial</span>
                        <span>{kv(detailSystem.meter_serial_number)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Accuracy class</span>
                        <span>{kv(detailSystem.meter_accuracy_class)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Installation date</span>
                        <span>{kv(detailSystem.installation_date)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {detailSystem ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              <Button onClick={() => goToEdit(detailSystem)} className="gap-2">
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

