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
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import type { SolarSystemRow } from "../../../types/api";
import { formatPakistanDateTime } from "../../../utils/pakistanTime";

const kv = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

export default function SolarSites() {
  const navigate = useNavigate();
  const { getSolarSystems } = useTehsilManagerOperatorApi();

  const [sites, setSites] = useState<SolarSystemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = await getSolarSystems({});
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
        s.id.toLowerCase().includes(q) ||
        (s.disco_info ?? "").toLowerCase().includes(q) ||
        (s.bill_reference_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [sites, search]);

  const openDetails = (s: SolarSystemRow) => {
    navigate(tehsilRoutes.solarSiteView(s.id));
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
              {loading ? "" : `${filtered.length} site(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by tehsil, village, DISCO, bill ref, UID, or ID…"
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
                      <TableHead>DISCO</TableHead>
                      <TableHead>Bill ref</TableHead>
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
                          colSpan={10}
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
                          <TableCell>{kv(s.disco_info)}</TableCell>
                          <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                            {kv(s.bill_reference_number)}
                          </TableCell>
                          <TableCell>{kv(s.solar_panel_capacity)}</TableCell>
                          <TableCell>{formatPakistanDateTime(s.created_at)}</TableCell>
                          <TableCell>{formatPakistanDateTime(s.updated_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetails(s)}
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
    </div>
  );
}
