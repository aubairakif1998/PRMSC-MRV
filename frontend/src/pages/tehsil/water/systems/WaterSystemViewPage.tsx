import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Gauge, Pencil } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../../constants/routes";
import { getApiErrorMessage } from "../../../../lib/api-error";
import { getWaterSystem } from "../../../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../../../../types/api";
import Toast from "../../../../components/Toast";
import { formatPakistanDateTime } from "../../../../utils/pakistanTime";

function kv(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function WaterSystemViewPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const id = String(systemId || "").trim();

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState<WaterSystemRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" }>({
    message: "",
    type: "success",
  });

  useEffect(() => {
    const run = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const res = (await getWaterSystem(id)) as WaterSystemRow;
        setSystem(res);
      } catch (e: unknown) {
        setToast({
          message: getApiErrorMessage(e, "Failed to load water system details"),
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 p-4 md:p-6">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(tehsilRoutes.waterSystems)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Water System Details
            </h1>
            <p className="text-sm text-muted-foreground">
              View complete technical and metering information.
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-3 pt-6">
              {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton key={idx} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : system ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                {kv(system.unique_identifier)}
              </Badge>
              <Badge variant="outline">{kv(system.tehsil)}</Badge>
              <Badge variant="outline">{kv(system.village)}</Badge>
              {system.settlement ? <Badge variant="outline">{kv(system.settlement)}</Badge> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Building2 className="size-4" />
                    Identity
                  </CardTitle>
                  <CardDescription>System metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">System ID</span>
                    <span className="font-mono text-xs">{system.id}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">UID</span>
                    <span className="font-mono text-xs">{kv(system.unique_identifier)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatPakistanDateTime(system.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatPakistanDateTime(system.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Gauge className="size-4" />
                    Technical & Metering
                  </CardTitle>
                  <CardDescription>Pump, capacity and active meter data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Bulk meter installed</span>
                    <Badge
                      variant={system.bulk_meter_installed ? "default" : "outline"}
                      className={system.bulk_meter_installed ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""}
                    >
                      {system.bulk_meter_installed ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Pump model</span>
                    <span>{kv(system.pump_model)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Pump serial</span>
                    <span>{kv(system.pump_serial_number)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Flow rate</span>
                    <span>{kv(system.pump_flow_rate)}</span>
                  </div>
                  {system.bulk_meter_installed ? (
                    <>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Meter model</span>
                        <span>{kv(system.meter_model)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Meter serial</span>
                        <span>{kv(system.meter_serial_number)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Accuracy class</span>
                        <span>{kv(system.meter_accuracy_class)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Installation date</span>
                        <span>{kv(system.installation_date)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Tank capacity (OHR)</span>
                        <span>{kv(system.ohr_tank_capacity)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                        <span className="text-muted-foreground">Required to fill tank</span>
                        <span>{kv(system.ohr_fill_required)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <Button variant="outline" onClick={() => navigate(tehsilRoutes.waterSystems)}>
                Back
              </Button>
              {system.unique_identifier ? (
                <Button
                  onClick={() => navigate(tehsilRoutes.waterFormEdit(system.unique_identifier || ""))}
                  className="gap-2"
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No system found for this route.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
