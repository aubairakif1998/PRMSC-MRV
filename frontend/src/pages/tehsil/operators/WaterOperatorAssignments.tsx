import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
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
import { ScrollArea } from "../../../components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
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
  water_systems_catalog: WaterSystemRef[];
};

export default function WaterOperatorAssignments() {
  const [data, setData] = useState<AssignmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Empty string = show all tehsils in the catalog (still only your tehsils from the server). */
  const [dialogTehsilFilter, setDialogTehsilFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getWaterOperatorAssignments();
      setData(raw as AssignmentsPayload);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Could not load operator assignments"),
      );
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
    setEditing(op);
    setSelectedIds(new Set(op.water_systems.map((w) => w.id)));
    setDialogTehsilFilter("");
    setDialogOpen(true);
  };

  const addAllSystemsInTehsil = (tehsilKey: string) => {
    const ids = idsInTehsil(tehsilKey);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const removeAllSystemsInTehsilFromSelection = (tehsilKey: string) => {
    const remove = new Set(idsInTehsil(tehsilKey));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of remove) next.delete(id);
      return next;
    });
  };

  const toggleSystem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCatalog = () => {
    const all = data?.water_systems_catalog.map((w) => w.id) ?? [];
    setSelectedIds(new Set(all));
  };

  const selectAllVisibleInFilter = () => {
    const ids = catalogByTehsilFiltered.flatMap(([, systems]) =>
      systems.map((s) => s.id),
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow">
            <Users className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tubewell operator assignments
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              See which operators are linked to which water systems in your tehsil.
              Changes only apply to systems you manage — other tehsils are not
              affected.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      <Alert variant="info">
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          Use <strong>Edit assignments</strong> to tick several water systems at
          once (only systems in <strong>your</strong> tehsil appear — the server
          enforces this). Filter by tehsil and use{" "}
          <strong>Add all in this tehsil</strong> to assign many sites in one
          tehsil quickly. Use <strong>Revoke all (my tehsil)</strong> to remove
          every link in your scope at once. New operator accounts:{" "}
          <strong>Onboard Operator</strong>.
        </AlertDescription>
      </Alert>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading assignments…</span>
        </div>
      ) : null}

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Operators and water systems</CardTitle>
            <CardDescription>
              {catalogLen === 0
                ? "No water systems are registered in your tehsil yet."
                : `${data.operators.length} operator(s) with assignments · ${catalogLen} water system(s) you can assign.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6">
            {catalogLen === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground sm:px-0">
                Register water systems first, then onboard operators or edit
                assignments here.
              </p>
            ) : data.operators.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground sm:px-0">
                No tubewell operators have water systems assigned in your tehsil
                yet. Use Onboard Operator to create an account, or refresh after
                linking systems elsewhere.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[140px]">Operator</TableHead>
                    <TableHead className="min-w-[180px]">Email</TableHead>
                    <TableHead>Assigned water systems</TableHead>
                    <TableHead className="w-[200px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.operators.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.water_systems.map((ws) => (
                            <Badge
                              key={ws.id}
                              variant="secondary"
                              className="max-w-[240px] truncate font-normal"
                              title={`${ws.unique_identifier} — ${ws.village}`}
                            >
                              {ws.village}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(row)}
                          >
                            Assign / edit systems
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={saving}
                            onClick={() => void revokeAllForOperator(row)}
                          >
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
          }
        }}
      >
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="gap-2 border-b px-4 py-4">
            <DialogTitle>Assign multiple water systems</DialogTitle>
            <DialogDescription>
              {editing ? (
                <>
                  Tick any combination of systems for{" "}
                  <strong>{editing.name}</strong>. The list only includes water
                  systems registered under <strong>your</strong> tehsil(s).{" "}
                  <span className="text-muted-foreground">
                    {selectedCount} selected.
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            {tehsilFilterOptions.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="assign-tehsil-filter" className="text-xs">
                  Filter list by tehsil
                </Label>
                <NativeSelect
                  id="assign-tehsil-filter"
                  className="w-full min-w-0"
                  value={dialogTehsilFilter}
                  onChange={(e) => setDialogTehsilFilter(e.target.value)}
                >
                  <NativeSelectOption value="">
                    All my tehsils ({catalogLen} systems)
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllCatalog}
                disabled={!catalogLen}
              >
                Select all (all tehsils)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllVisibleInFilter}
                disabled={
                  !catalogLen ||
                  (dialogTehsilFilter
                    ? idsInTehsil(dialogTehsilFilter).length === 0
                    : catalogLen === 0)
                }
                title={
                  dialogTehsilFilter
                    ? `Add every system under ${dialogTehsilFilter} to the selection`
                    : "Add every visible system to the selection"
                }
              >
                {dialogTehsilFilter
                  ? `Add all visible (${catalogByTehsilFiltered.reduce((acc, [, s]) => acc + s.length, 0)})`
                  : "Add all visible"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedCount === 0}
              >
                Clear selection
              </Button>
            </div>
            {dialogTehsilFilter ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addAllSystemsInTehsil(dialogTehsilFilter)}
                >
                  Add all systems in this tehsil
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    removeAllSystemsInTehsilFromSelection(dialogTehsilFilter)
                  }
                >
                  Remove this tehsil from selection
                </Button>
              </div>
            ) : tehsilFilterOptions.length === 1 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    addAllSystemsInTehsil(tehsilFilterOptions[0] ?? "")
                  }
                  disabled={!tehsilFilterOptions[0]}
                >
                  Add all {idsInTehsil(tehsilFilterOptions[0] ?? "").length}{" "}
                  systems in your tehsil
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    removeAllSystemsInTehsilFromSelection(
                      tehsilFilterOptions[0] ?? "",
                    )
                  }
                  disabled={!tehsilFilterOptions[0]}
                >
                  Remove your tehsil from selection
                </Button>
              </div>
            ) : tehsilFilterOptions.length > 1 ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                <span className="w-full text-xs text-muted-foreground">
                  Or pick a tehsil above, then add every system in that tehsil in
                  one step.
                </span>
              </div>
            ) : null}
            <ScrollArea className="h-[min(50vh,360px)] rounded-lg border bg-muted/20 p-3">
              {catalogByTehsil.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No systems in catalog.
                </p>
              ) : (
                <div className="space-y-4">
                  {catalogByTehsilFiltered.map(([tehsil, systems]) => (
                    <div key={tehsil}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tehsil}
                      </p>
                      <ul className="space-y-2">
                        {systems.map((s) => {
                          const checked = selectedIds.has(s.id);
                          return (
                            <li
                              key={s.id}
                              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <Checkbox
                                id={`ws-${s.id}`}
                                checked={checked}
                                onCheckedChange={() => toggleSystem(s.id)}
                              />
                              <Label
                                htmlFor={`ws-${s.id}`}
                                className="cursor-pointer text-sm leading-snug font-normal"
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
            </ScrollArea>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveAssignments()}
              disabled={saving || !editing}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save assignments"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
