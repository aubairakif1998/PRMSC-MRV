import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Droplets,
  Info,
  Loader2,
  PencilLine,
  RefreshCw,
  ShieldOff,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { cn } from "../../../lib/utils";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  getWaterOperatorAssignments,
  replaceWaterOperatorAssignments,
} from "../../../services/tehsilManagerOperatorService";

type WaterSystemRef = {
  id: string;
  unique_identifier: string;
  village: string;
  tehsil: string;
  settlement?: string | null;
};

type OperatorRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  water_systems: WaterSystemRef[];
};

type AssignmentsPayload = {
  operators: OperatorRow[];
  /** All tubewell operators you may assign in your scope (includes operators with no local links yet). */
  eligible_operators?: OperatorRow[];
  water_systems_catalog: WaterSystemRef[];
};

type AssignmentDialogFlow = "edit" | "add";

export default function WaterOperatorAssignments() {
  const navigate = useNavigate();
  const [data, setData] = useState<AssignmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFlow, setDialogFlow] = useState<AssignmentDialogFlow>("edit");
  const [editing, setEditing] = useState<OperatorRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Empty string = show all tehsils in the catalog (still only your tehsils from the server). */
  const [dialogTehsilFilter, setDialogTehsilFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getWaterOperatorAssignments();
      const p = raw as AssignmentsPayload;
      if (!p.eligible_operators?.length && p.operators?.length) {
        p.eligible_operators = p.operators;
      }
      setData(p);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load operator assignments"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogByTehsil = useMemo(() => {
    const catalog = data?.water_systems_catalog ?? [];
    const m = new Map<string, WaterSystemRef[]>();
    for (const s of catalog) {
      const t = s.tehsil?.trim() || "—";
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data?.water_systems_catalog]);

  const tehsilFilterOptions = useMemo(
    () => catalogByTehsil.map(([t]) => t),
    [catalogByTehsil],
  );

  const eligibleOperatorList = useMemo(() => {
    const list = data?.eligible_operators ?? data?.operators ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [data?.eligible_operators, data?.operators]);

  const catalogByTehsilFiltered = useMemo(() => {
    if (!dialogTehsilFilter) return catalogByTehsil;
    return catalogByTehsil.filter(([t]) => t === dialogTehsilFilter);
  }, [catalogByTehsil, dialogTehsilFilter]);

  const idsInTehsil = useCallback(
    (tehsilKey: string) => {
      const row = catalogByTehsil.find(([t]) => t === tehsilKey);
      return (row?.[1] ?? []).map((s) => s.id);
    },
    [catalogByTehsil],
  );

  const openEdit = (op: OperatorRow) => {
    setDialogFlow("edit");
    setEditing(op);
    setSelectedIds(new Set(op.water_systems.map((w) => w.id)));
    setDialogTehsilFilter("");
    setDialogOpen(true);
  };

  const openAddAssignment = () => {
    setDialogFlow("add");
    setEditing(null);
    setSelectedIds(new Set());
    setDialogTehsilFilter("");
    setDialogOpen(true);
  };

  const onPickOperatorForAdd = (operatorId: string) => {
    if (!operatorId.trim()) {
      setEditing(null);
      setSelectedIds(new Set());
      return;
    }
    const op = eligibleOperatorList.find((o) => o.id === operatorId);
    if (!op) return;
    setEditing(op);
    setSelectedIds(new Set(op.water_systems.map((w) => w.id)));
  };

  const toggleSystem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await replaceWaterOperatorAssignments(editing.id, [...selectedIds]);
      toast.success("Assignments updated.");
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not save assignments"));
    } finally {
      setSaving(false);
    }
  };

  const revokeAllForOperator = async (op: OperatorRow) => {
    const ok = window.confirm(
      `Remove all water system access for ${op.name} in your tehsil scope? They will keep assignments in other areas (if any) managed by other admins.`,
    );
    if (!ok) return;
    try {
      setSaving(true);
      await replaceWaterOperatorAssignments(op.id, []);
      toast.success("Assignments revoked for your tehsil scope.");
      await load();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not revoke assignments"));
    } finally {
      setSaving(false);
    }
  };

  const catalogLen = data?.water_systems_catalog.length ?? 0;
  const selectedCount = selectedIds.size;
  const operatorCount = data?.operators.length ?? 0;
  const tehsilCount = tehsilFilterOptions.length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 pb-12 md:p-8">
      <header className="flex flex-col gap-6 border-b border-border/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
            aria-hidden
          >
            <Users className="size-7" />
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Tubewell operator assignments
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Link tubewell operators to water systems you manage. Assignments
              are limited to your tehsil scope; other districts are never
              changed.
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="default"
            size="default"
            className="gap-2 shadow-sm"
            onClick={openAddAssignment}
            disabled={loading || catalogLen === 0}
            title={
              catalogLen === 0
                ? "Register water systems in your tehsil first"
                : undefined
            }
          >
            <UserPlus className="size-4" />
            Add assignment
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="gap-2 shadow-sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh data
          </Button>
        </div>
      </header>

      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card size="sm" className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Operators (in scope)</CardDescription>
              <CardTitle className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                {operatorCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Water systems you can assign</CardDescription>
              <CardTitle className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                {catalogLen}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm" className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Tehsils in your catalog</CardDescription>
              <CardTitle className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                {tehsilCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <Alert variant="info" className="border-primary/20 py-3 shadow-sm">
        <Info className="size-4 shrink-0" aria-hidden />
        <AlertDescription className="text-sm leading-relaxed">
          Use <strong className="text-foreground">Add assignment</strong> to link
          water systems to a tubewell operator (including one with no sites in
          your tehsil yet). Open{" "}
          <strong className="text-foreground">Assign / edit</strong> on a row to
          change an existing link. Only your tehsil&apos;s systems appear. New
          accounts: <strong className="text-foreground">Onboard Operator</strong>
          .
        </AlertDescription>
      </Alert>

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      ) : null}

      {data ? (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border/80 bg-muted/20 pb-4">
            <CardTitle className="font-heading text-lg sm:text-xl">
              Assignment overview
            </CardTitle>
            <CardDescription className="text-base">
              {catalogLen === 0
                ? "No water systems are registered in your tehsil yet."
                : `${operatorCount} operator${operatorCount === 1 ? "" : "s"} linked · ${catalogLen} system${catalogLen === 1 ? "" : "s"} available to assign.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-0 pt-0 sm:px-0">
            {catalogLen === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Droplets className="size-6 text-muted-foreground" />
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  Register water systems first, then onboard operators or return
                  here to manage assignments.
                </p>
              </div>
            ) : data.operators.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No operators are linked to your water systems yet. Use{" "}
                  <span className="font-medium text-foreground">
                    Onboard Operator
                  </span>{" "}
                  to create an account, then assign systems here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/80 hover:bg-transparent">
                    <TableHead className="min-w-[140px] pl-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Operator
                    </TableHead>
                    <TableHead className="min-w-[200px] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Assigned water systems
                    </TableHead>
                    <TableHead className="w-[220px] pr-6 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.operators.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/60 transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="pl-6 align-top">
                        <div className="font-medium text-foreground">
                          {row.name}
                        </div>
                        {row.phone ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {row.phone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {row.water_systems.map((ws) => (
                            <Badge
                              key={ws.id}
                              variant="outline"
                              className="max-w-[220px] truncate border-border/80 bg-card font-normal text-foreground"
                              title={`${ws.unique_identifier} — ${ws.village}`}
                            >
                              {ws.village}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-right align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="gap-1.5 shadow-sm"
                            onClick={() => openEdit(row)}
                          >
                            <PencilLine className="size-3.5" />
                            Assign / edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={saving}
                            onClick={() => void revokeAllForOperator(row)}
                          >
                            <ShieldOff className="size-3.5" />
                            Revoke all
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setDialogTehsilFilter("");
            setDialogFlow("edit");
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-border/80 p-0 shadow-lg sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-3 border-b border-border/80 bg-muted/30 px-6 py-5">
            <DialogTitle className="font-heading text-lg sm:text-xl">
              {dialogFlow === "add" ? "New assignment" : "Assign water systems"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {dialogFlow === "add" && !editing ? (
                <>
                  Choose a tubewell operator, then select the water systems they
                  should log for in your tehsil.
                </>
              ) : editing ? (
                <>
                  Select systems for{" "}
                  <span className="font-medium text-foreground">
                    {editing.name}
                  </span>
                  . Only facilities under your tehsil(s) are listed.{" "}
                  <span className="tabular-nums text-muted-foreground">
                    {selectedCount} selected
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {dialogFlow === "add" ? (
              <div className="space-y-2">
                <Label
                  htmlFor="assign-pick-operator"
                  className="text-sm font-medium text-foreground"
                >
                  Tubewell operator
                </Label>
                <Select
                  value={editing?.id ?? "__none__"}
                  onValueChange={(v) =>
                    onPickOperatorForAdd(
                      v == null || v === "__none__" ? "" : v,
                    )
                  }
                  disabled={eligibleOperatorList.length === 0}
                >
                  <SelectTrigger
                    id="assign-pick-operator"
                    className="h-11 w-full min-w-0 text-base"
                  >
                    <SelectValue placeholder="Select an operator…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select an operator…</SelectItem>
                    {eligibleOperatorList.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} — {op.email}
                        {op.water_systems.length === 0
                          ? " (no sites in your tehsil yet)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eligibleOperatorList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    There are no tubewell operator accounts to assign yet. Create
                    one under{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-2"
                      onClick={() => navigate(tehsilRoutes.onboardOperator)}
                    >
                      Onboard Operator
                    </button>
                    , then use Refresh data and try again.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className={cn(
                "space-y-4",
                dialogFlow === "add" && !editing && eligibleOperatorList.length > 0
                  ? "pointer-events-none opacity-45"
                  : "",
              )}
            >
            {tehsilFilterOptions.length > 1 ? (
              <div className="space-y-2">
                <Label
                  htmlFor="assign-tehsil-filter"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Filter by tehsil
                </Label>
                <NativeSelect
                  id="assign-tehsil-filter"
                  className="h-11 w-full min-w-0 text-base"
                  value={dialogTehsilFilter}
                  onChange={(e) => setDialogTehsilFilter(e.target.value)}
                >
                  <NativeSelectOption value="">
                    All tehsils ({catalogLen} systems)
                  </NativeSelectOption>
                  {tehsilFilterOptions.map((t) => {
                    const n = idsInTehsil(t).length;
                    return (
                      <NativeSelectOption key={t} value={t}>
                        {t} ({n} systems)
                      </NativeSelectOption>
                    );
                  })}
                </NativeSelect>
              </div>
            ) : null}

            <ScrollArea className="h-[min(52vh,400px)] rounded-xl border border-border/80 bg-card shadow-sm">
              <div className="p-3">
                {catalogByTehsil.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No systems in catalog.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {catalogByTehsilFiltered.map(([tehsil, systems]) => (
                      <div key={tehsil}>
                        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {tehsil}
                        </p>
                        <ul className="space-y-2">
                          {systems.map((s) => {
                            const checked = selectedIds.has(s.id);
                            return (
                              <li
                                key={s.id}
                                className={cn(
                                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                                  checked
                                    ? "border-primary/35 bg-primary/5"
                                    : "border-border/60 bg-background hover:bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  id={`ws-${s.id}`}
                                  checked={checked}
                                  onCheckedChange={() => toggleSystem(s.id)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`ws-${s.id}`}
                                  className="min-w-0 flex-1 cursor-pointer text-sm leading-snug font-normal"
                                >
                                  <span className="font-medium text-foreground">
                                    {s.village}
                                  </span>
                                  {s.settlement ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {s.settlement}
                                    </span>
                                  ) : null}
                                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                                    {s.unique_identifier}
                                  </span>
                                </Label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border/80 bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-w-[160px] gap-2 shadow-sm"
              onClick={() => void saveAssignments()}
              disabled={saving || !editing}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Save changes
                  <Check className="size-4 opacity-90" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
