import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Pencil, Plus, RefreshCcw, Search, Zap } from "lucide-react";

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
import type { SolarSystemRow } from "../../../types/api";

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

export default function SolarSites() {
  const navigate = useNavigate();
  const { getSolarSystems, getSolarSystem } = useTehsilManagerOperatorApi();

  const [sites, setSites] = useState<SolarSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSite, setDetailSite] = useState<SolarSystemRow | null>(null);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = await getSolarSystems();
      setSites(Array.isArray(data) ? (data as SolarSystemRow[]) : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load solar sites"));
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
    if (!q) return sites;
    return sites.filter((s) => {
      return (
        s.tehsil?.toLowerCase().includes(q) ||
        s.village?.toLowerCase().includes(q) ||
        (s.settlement ?? "").toLowerCase().includes(q) ||
        (s.unique_identifier ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [sites, search]);

  const openDetails = async (s: SolarSystemRow) => {
    setDetailSite(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = (await getSolarSystem(s.id)) as SolarSystemRow;
      setDetailSite(detail);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load site details"));
    } finally {
      setDetailLoading(false);
    }
  };

  const goToEdit = (s: SolarSystemRow) => {
    navigate(tehsilRoutes.solarSiteEdit(s.id));
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Solar Systems
            </h1>
            <p className="text-sm text-muted-foreground">
              View and manage registered solar systems in your tehsil scope.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={() => navigate(tehsilRoutes.solarForm)}
              className="gap-2"
            >
              <Plus className="size-4" />
              Register Solar Systems
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(tehsilRoutes.solarEnergyAdd)}
              className="gap-2"
            >
              <Zap className="size-4" />
              Add monthly log
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All sites</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} site(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tehsil, village, UID, or ID…"
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
                      <TableHead>Panel (kW)</TableHead>
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
                          No solar sites found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            {kv(s.tehsil)}
                          </TableCell>
                          <TableCell>{kv(s.village)}</TableCell>
                          <TableCell>{kv(s.settlement)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {kv(s.unique_identifier)}
                          </TableCell>
                          <TableCell>{kv(s.solar_panel_capacity)}</TableCell>
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
          if (!v) setDetailSite(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Solar site details</DialogTitle>
            <DialogDescription>
              {detailSite
                ? `${detailSite.tehsil} • ${detailSite.village}${
                    detailSite.settlement ? ` • ${detailSite.settlement}` : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, idx) => (
                <Skeleton key={idx} className="h-4 w-full" />
              ))}
            </div>
          ) : detailSite ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">System ID</span>
                    <span className="font-mono text-xs">{detailSite.id}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">UID</span>
                    <span className="font-mono text-xs">
                      {kv(detailSite.unique_identifier)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(detailSite.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(detailSite.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Technical</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Installation location
                    </span>
                    <span>{kv(detailSite.installation_location)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Panel capacity
                    </span>
                    <span>{kv(detailSite.solar_panel_capacity)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Inverter capacity
                    </span>
                    <span>{kv(detailSite.inverter_capacity)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Inverter serial
                    </span>
                    <span>{kv(detailSite.inverter_serial_number)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Installation date
                    </span>
                    <span>{kv(detailSite.installation_date)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Monthly logs</span>
                    <span>{kv(detailSite.monthly_log_count)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {detailSite ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              <Button onClick={() => goToEdit(detailSite)} className="gap-2">
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
