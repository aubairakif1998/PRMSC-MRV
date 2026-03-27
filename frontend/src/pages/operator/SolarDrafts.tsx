import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Clock,
  Edit,
  FileText,
  Loader2,
  Plus,
  Send,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import Toast from "../../components/Toast";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Alert, AlertDescription as InlineAlertDescription } from "../../components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Skeleton } from "../../components/ui/skeleton";
import { useOperatorApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";

type ToastType = "success" | "error";

type SolarDraft = {
  id: number;
  tehsil: string;
  village: string;
  month: number;
  year: number;
};

type SolarSystem = {
  id: number;
  created_by?: number;
  tehsil: string;
  village: string;
  unique_identifier?: string;
  solar_panel_capacity?: number | null;
};

type DeleteTarget = {
  id: number;
  kind: "draft" | "system";
  title: string;
  description: string;
  actionLabel: string;
};

const SolarDrafts = () => {
  const {
    getSolarDrafts,
    submitSolarDraft,
    getSolarSystems,
    deleteSolarSystem,
    deleteSolarDraft,
  } = useOperatorApi();
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<SolarDraft[]>([]);
  const [systems, setSystems] = useState<SolarSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [draftsRes, systemsRes] = await Promise.all([
        getSolarDrafts(),
        getSolarSystems(),
      ]);
      setDrafts((draftsRes.drafts as SolarDraft[]) || []);

      const userId = JSON.parse(localStorage.getItem("mrv_user") || "{}").id;
      const userSystems = ((systemsRes as SolarSystem[]) || []).filter(
        (s: SolarSystem) => s.created_by === userId,
      );
      setSystems(userSystems);
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Synchronization error."),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraft = async (draftId: number) => {
    setSubmitting((prev) => ({ ...prev, [draftId]: true }));
    try {
      await submitSolarDraft(draftId);
      setToast({ message: "Solar report published for review!", type: "success" });
      await loadData();
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Submission failed"),
        type: "error",
      });
    } finally {
      setSubmitting((prev) => ({ ...prev, [draftId]: false }));
    }
  };

  const handleDeleteSystem = async (systemId: number) => {
    const key = `system-${systemId}`;
    setDeleting((prev) => ({ ...prev, [key]: true }));
    try {
      await deleteSolarSystem(systemId);
      setToast({
        message: "Asset status updated to decommissioned",
        type: "success",
      });
      await loadData();
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Failed to update asset status"),
        type: "error",
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteDraft = async (draftId: number) => {
    const key = `draft-${draftId}`;
    setDeleting((prev) => ({ ...prev, [key]: true }));
    try {
      await deleteSolarDraft(draftId);
      setToast({ message: "Draft purged from system memory", type: "success" });
      await loadData();
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Purge operation failed"),
        type: "error",
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const openDeleteDialog = (target: DeleteTarget) => {
    setDeleteTarget(target);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteDialogOpen(false);

    if (deleteTarget.kind === "draft") {
      await handleDeleteDraft(deleteTarget.id);
      return;
    }

    await handleDeleteSystem(deleteTarget.id);
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl space-y-6 bg-slate-50 p-4 md:p-6">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {deleteTarget?.title || "Confirm deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.description || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert variant="destructive">
            <InlineAlertDescription>
              Deleted records cannot be recovered.
            </InlineAlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              {deleteTarget?.actionLabel || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-slate-200">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/operator")}
              className="border-slate-200 text-slate-600"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm">
              <Sun className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">
                Solar Utility Hub
              </h1>
              <p className="text-sm text-slate-600">
                Energy generation tracking and asset maintenance
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate("/operator/solar-form")}
            className="h-10 gap-2 bg-amber-500 text-white hover:bg-amber-600"
          >
            <Plus className="size-4" />
            Add Solar Plant
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <DraftsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Zap className="size-4 text-amber-500" />
                  Generation Logs
                </CardTitle>
                <CardDescription>
                  Review, edit, and publish pending monthly solar drafts.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-amber-200 text-amber-700">
                {drafts.length} drafts
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {drafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
                  <Sun className="mx-auto mb-3 size-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">
                    Solar database clear
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    All generation reports have been pushed for verification.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[34rem] pr-2">
                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <Card key={draft.id} className="border-slate-200">
                        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-600">
                              <Sun className="size-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {draft.village}
                                <span className="ml-2 font-medium text-slate-500">
                                  / {draft.tehsil}
                                </span>
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="size-3.5" />
                                  {draft.month}/{draft.year}
                                </span>
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                  <Clock className="size-3.5" />
                                  Ready to publish
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() =>
                                navigate(
                                  `/operator/solar-energy-data?draft=${draft.id}`,
                                )
                              }
                            >
                              <Edit className="size-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1.5"
                              disabled={Boolean(deleting[`draft-${draft.id}`])}
                              onClick={() =>
                                openDeleteDialog({
                                  id: draft.id,
                                  kind: "draft",
                                  title: "Delete draft record?",
                                  description:
                                    "This will permanently remove the selected solar draft.",
                                  actionLabel: "Delete Draft",
                                })
                              }
                            >
                              {deleting[`draft-${draft.id}`] ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 bg-amber-500 text-white hover:bg-amber-600"
                              disabled={Boolean(submitting[draft.id])}
                              onClick={() => handleSubmitDraft(draft.id)}
                            >
                              {submitting[draft.id] ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Send className="size-3.5" />
                              )}
                              Publish
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="size-4 text-slate-600" />
                Registered Plants
              </CardTitle>
              <CardDescription>
                Manage mapped assets for monthly generation logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {systems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No solar assets linked.
                </div>
              ) : (
                <ScrollArea className="max-h-[30rem] pr-2">
                  <div className="space-y-3">
                    {systems.map((system) => (
                      <Card key={system.id} size="sm" className="border-slate-200">
                        <CardContent className="flex items-center justify-between gap-3 p-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                              Plant key:{" "}
                              {system.unique_identifier?.substring(0, 8) ?? "N/A"}
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                              {system.village}
                            </p>
                            <p className="text-xs text-slate-600">
                              Capacity: {system.solar_panel_capacity || 0} kWp
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() =>
                                navigate(
                                  `/operator/solar-energy-data?system=${system.id}`,
                                )
                              }
                            >
                              <Plus className="size-3.5" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              disabled={Boolean(deleting[`system-${system.id}`])}
                              onClick={() =>
                                openDeleteDialog({
                                  id: system.id,
                                  kind: "system",
                                  title: "Decommission solar asset?",
                                  description:
                                    "This will remove the selected solar system and related generation history.",
                                  actionLabel: "Delete Asset",
                                })
                              }
                            >
                              {deleting[`system-${system.id}`] ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

function DraftsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
      <Card className="border-slate-200">
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default SolarDrafts;
