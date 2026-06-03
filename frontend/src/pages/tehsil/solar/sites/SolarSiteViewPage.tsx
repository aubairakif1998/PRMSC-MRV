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
import { getSolarSystem } from "../../../../services/tehsilManagerOperatorService";
import type { SolarSystemRow } from "../../../../types/api";
import Toast from "../../../../components/Toast";
import { formatPakistanDateTime } from "../../../../utils/pakistanTime";

function kv(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function SolarSiteViewPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const id = String(systemId || "").trim();

  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<SolarSystemRow | null>(null);
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
        const res = (await getSolarSystem(id)) as SolarSystemRow;
        setSite(res);
      } catch (e: unknown) {
        setToast({
          message: getApiErrorMessage(e, "Failed to load solar site details"),
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
          <Button variant="outline" size="icon" onClick={() => navigate(tehsilRoutes.solarSites)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Solar Site Details
            </h1>
            <p className="text-sm text-muted-foreground">
              View complete site registration and technical information.
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
        ) : site ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                {kv(site.unique_identifier)}
              </Badge>
              <Badge variant="outline">{kv(site.tehsil)}</Badge>
              <Badge variant="outline">{kv(site.village)}</Badge>
              {site.settlement ? <Badge variant="outline">{kv(site.settlement)}</Badge> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Building2 className="size-4" />
                    Identity
                  </CardTitle>
                  <CardDescription>Site metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">System ID</span>
                    <span className="font-mono text-xs">{site.id}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">UID</span>
                    <span className="font-mono text-xs">{kv(site.unique_identifier)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatPakistanDateTime(site.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatPakistanDateTime(site.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Gauge className="size-4" />
                    Technical Overview
                  </CardTitle>
                  <CardDescription>Generation, inverter and meter details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Installation location</span>
                    <span>{kv(site.installation_location)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">DISCO / Electricity provider</span>
                    <span>{kv(site.disco_info)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="shrink-0 text-muted-foreground">
                      Bill reference number
                    </span>
                    <span className="break-all text-right font-mono text-xs">
                      {kv(site.bill_reference_number)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Panel capacity (kW)</span>
                    <span>{kv(site.solar_panel_capacity)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Inverter capacity</span>
                    <span>{kv(site.inverter_capacity)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Inverter serial</span>
                    <span>{kv(site.inverter_serial_number)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Solar connection date</span>
                    <span>{kv(site.solar_connection_date ?? site.installation_date)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Meter model</span>
                    <span>{kv(site.meter_model)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Meter serial</span>
                    <span>{kv(site.meter_serial_number)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-slate-50/60 px-3 py-2">
                    <span className="text-muted-foreground">Monthly logs</span>
                    <span>{kv(site.monthly_log_count)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <Button variant="outline" onClick={() => navigate(tehsilRoutes.solarSites)}>
                Back
              </Button>
              <Button onClick={() => navigate(tehsilRoutes.solarSiteEdit(site.id))} className="gap-2">
                <Pencil className="size-4" />
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No solar site found for this route.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
