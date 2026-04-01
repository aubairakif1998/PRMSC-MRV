import { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl, type ViewState, type ViewStateChangeEvent } from "react-map-gl";
import { Droplets, Sun } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { getApiErrorMessage } from "../../lib/api-error";
import { toast } from "sonner";
import { getSolarSystems, getWaterSystems } from "../../services/tehsilManagerOperatorService";
import type { SolarSystemRow, WaterSystemRow } from "../../types/api";

import "mapbox-gl/dist/mapbox-gl.css";

type GeoPoint = {
  id: string;
  type: "water" | "solar";
  uid: string;
  tehsil: string;
  village: string;
  latitude: number;
  longitude: number;
};

const PUNJAB_BOUNDS: [[number, number], [number, number]] = [
  // [minLng, minLat], [maxLng, maxLat]
  [69.2, 27.6],
  [75.8, 34.2],
];

const DEFAULT_VIEW: ViewState = {
  longitude: 73.2,
  latitude: 31.2,
  zoom: 6.3,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function SystemsMapCard() {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<GeoPoint[]>([]);

  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW);

  const load = async () => {
    try {
      setLoading(true);
      const [waterRaw, solarRaw] = await Promise.all([
        getWaterSystems(),
        getSolarSystems(),
      ]);
      const water = (Array.isArray(waterRaw) ? waterRaw : []) as WaterSystemRow[];
      const solar = (Array.isArray(solarRaw) ? solarRaw : []) as SolarSystemRow[];

      const mapped: GeoPoint[] = [];

      for (const w of water) {
        const lat = toNumber(w.latitude);
        const lng = toNumber(w.longitude);
        if (lat == null || lng == null) continue;
        mapped.push({
          id: w.id,
          type: "water",
          uid: String(w.unique_identifier ?? w.id),
          tehsil: String(w.tehsil ?? ""),
          village: String(w.village ?? ""),
          latitude: lat,
          longitude: lng,
        });
      }

      for (const s of solar) {
        const lat = toNumber(s.latitude);
        const lng = toNumber(s.longitude);
        if (lat == null || lng == null) continue;
        mapped.push({
          id: s.id,
          type: "solar",
          uid: String(s.unique_identifier ?? s.id),
          tehsil: String(s.tehsil ?? ""),
          village: String(s.village ?? ""),
          latitude: lat,
          longitude: lng,
        });
      }

      setPoints(mapped);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load geo points"));
      setPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    let water = 0;
    let solar = 0;
    for (const p of points) {
      if (p.type === "water") water += 1;
      else solar += 1;
    }
    return { water, solar, total: points.length };
  }, [points]);

  if (!token || token.trim() === "") {
    return (
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Installed systems map</CardTitle>
          <CardDescription>
            Add <code className="font-mono">VITE_MAPBOX_ACCESS_TOKEN</code> to your{" "}
            <code className="font-mono">frontend/.env</code> to enable the map.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            Map disabled: missing Mapbox token.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Installed systems map (Punjab)</CardTitle>
          <CardDescription>
            Water and solar systems with saved latitude/longitude.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Droplets className="size-3.5 text-blue-600" /> Water: {counts.water}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Sun className="size-3.5 text-amber-600" /> Solar: {counts.solar}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[420px] w-full" /> : null}
        <div className={`relative ${loading ? "hidden" : ""}`}>
          <div className="h-[420px] overflow-hidden rounded-xl border">
            <Map
              mapboxAccessToken={token}
              mapStyle="mapbox://styles/mapbox/light-v11"
              initialViewState={DEFAULT_VIEW}
              {...viewState}
              onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
              maxBounds={PUNJAB_BOUNDS}
              minZoom={5.5}
              maxZoom={13}
              dragRotate={false}
              renderWorldCopies={false}
            >
              <NavigationControl position="bottom-right" showCompass={false} />

              {points.map((p) => (
                <Marker
                  key={`${p.type}-${p.id}`}
                  longitude={p.longitude}
                  latitude={p.latitude}
                  anchor="center"
                >
                  <div
                    title={`${p.uid}\n${p.village}, ${p.tehsil}`}
                    className={[
                      "size-3 rounded-full ring-2 ring-white shadow-sm",
                      p.type === "water" ? "bg-blue-600" : "bg-amber-500",
                    ].join(" ")}
                  />
                </Marker>
              ))}
            </Map>
          </div>
          {counts.total === 0 ? (
            <div className="mt-3 rounded-xl border bg-muted/10 p-3 text-sm text-muted-foreground">
              No geo points found yet. Add latitude/longitude to water/solar systems to show them here.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

