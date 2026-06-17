import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import { Droplets, MapPin, Maximize2, Sun } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { getApiErrorMessage } from "../../lib/api-error";
import { toast } from "sonner";
import {
  getSolarSystems,
  getWaterSystems,
} from "../../services/tehsilManagerOperatorService";
import type { QueryFilters } from "../../services/types";
import type { SolarSystemRow, WaterSystemRow } from "../../types/api";

import pakistanOutlineJson from "../../data/pakistan-outline.json";
import punjabPkBoundaryJson from "../../data/punjab-pk-boundary.json";

import "leaflet/dist/leaflet.css";

const pakistanOutline = pakistanOutlineJson as FeatureCollection;
const punjabPkBoundary = punjabPkBoundaryJson as unknown as FeatureCollection;

type GeoPoint = {
  id: string;
  type: "water" | "solar";
  uid: string;
  tehsil: string;
  village: string;
  latitude: number;
  longitude: number;
  approximate?: boolean;
};

export type SystemsMapFilters = {
  tehsil: string;
  village: string;
};

const PAKISTAN_VIEW_BOUNDS_LNGLAT: [[number, number], [number, number]] = [
  [60.45, 23.25],
  [78.05, 37.25],
];

const MAP_MAX_BOUNDS_LEAFLET: L.LatLngBoundsExpression = [
  [22.5, 59.5],
  [38.0, 79.0],
];

/** Esri World Street Map — executive dashboard basemap. */
const ESRI_WORLD_STREET_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const CARTO_LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowLatLng(row: Record<string, unknown>): {
  lat: number | null;
  lng: number | null;
} {
  const lat = toNumber(row.latitude ?? row.lat ?? row.Latitude);
  const lng = toNumber(row.longitude ?? row.lng ?? row.lon ?? row.Longitude);
  return { lat, lng };
}

function normalizeListPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.systems)) return o.systems;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

function approximateLatLng(
  seed: string,
  type: "water" | "solar",
): { latitude: number; longitude: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 10001) / 10000;
  const v = (((h * 1103515245) >>> 0) % 10001) / 10000;
  const lat = 29.0 + u * 5.8;
  const lng = 69.8 + v * 8.2;
  const nudge = type === "solar" ? 0.04 : -0.04;
  return {
    latitude: lat + nudge * (u - 0.5),
    longitude: lng + nudge * (v - 0.5),
  };
}

function createTeardropPinIcon(p: GeoPoint): L.DivIcon {
  const fill = p.type === "water" ? "#2563eb" : "#d97706";
  const ring = p.approximate ? "#94a3b8" : "#ffffff";
  const dash = p.approximate ? 'stroke-dasharray="4 3"' : "";
  const html = `<div class="hq-leaflet-pin-wrap" aria-hidden="true">
    <svg width="40" height="52" viewBox="0 0 64 84" xmlns="http://www.w3.org/2000/svg">
      <path fill="${fill}" stroke="${ring}" stroke-width="3" stroke-linejoin="round" ${dash}
        d="M32 4C17.6 4 6 15.2 6 29.2c0 16.5 22.2 46.4 24.6 49.4.9 1.1 2.3 1.1 3.2 0C36.2 75.6 58 45.7 58 29.2 58 15.2 46.4 4 32 4z"/>
      <circle cx="32" cy="28" r="9" fill="#ffffff"/>
    </svg>
  </div>`;
  return L.divIcon({
    className: "hq-leaflet-pin-icon",
    html,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -48],
  });
}

function MapViewBounds({
  points,
  ready,
}: {
  points: GeoPoint[];
  ready: boolean;
}) {
  const map = useMap();
  const signature = useMemo(
    () => points.map((p) => `${p.id}:${p.latitude},${p.longitude}`).join("|"),
    [points],
  );

  useEffect(() => {
    if (!ready) return;
    map.invalidateSize();
    if (points.length === 0) {
      const [[west, south], [east, north]] = PAKISTAN_VIEW_BOUNDS_LNGLAT;
      const bounds = L.latLngBounds(
        L.latLng(south, west),
        L.latLng(north, east),
      );
      map.fitBounds(bounds, {
        padding: [20, 64],
        maxZoom: 6.4,
        animate: false,
      });
      return;
    }
    if (points.length === 1) {
      const only = points[0];
      if (!only) return;
      map.setView([only.latitude, only.longitude], 10, { animate: false });
      return;
    }
    const latlngs = points.map((p) => L.latLng(p.latitude, p.longitude));
    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
    }
  }, [map, ready, signature]);

  return null;
}

function mapListQuery(filters: SystemsMapFilters): QueryFilters {
  return {
    tehsil: filters.tehsil,
    village: filters.village,
  };
}

function MapLegend({ compact }: { compact?: boolean | undefined }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-2 left-2 z-[500] flex flex-wrap gap-1.5 rounded-lg border border-border/70 bg-background/92 px-2 py-1.5 shadow-sm backdrop-blur-sm ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      <span className="flex items-center gap-1 font-medium text-foreground">
        <span className="size-2 rounded-full bg-blue-600" />
        Water
      </span>
      <span className="flex items-center gap-1 font-medium text-foreground">
        <span className="size-2 rounded-full bg-amber-600" />
        Solar
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="size-2 rounded-full border border-dashed border-slate-400 bg-transparent" />
        Approx.
      </span>
    </div>
  );
}

function SystemsMapCanvas({
  mapRef,
  points,
  loading,
  heightClass,
  onReady,
  scopeLabel,
  compact,
  lightBasemap,
}: {
  mapRef: MutableRefObject<L.Map | null>;
  points: GeoPoint[];
  loading: boolean;
  heightClass: string;
  onReady: () => void;
  scopeLabel?: string | undefined;
  compact?: boolean | undefined;
  lightBasemap?: boolean | undefined;
}) {
  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-slate-50/80 to-muted/30 shadow-inner [&_.leaflet-container]:z-0 ${heightClass}`}
    >
      {scopeLabel ? (
        <div className="pointer-events-none absolute left-2 top-2 z-[500] max-w-[calc(100%-4.5rem)] rounded-lg border border-border/60 bg-background/92 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            Active scope
          </p>
          <p className="truncate text-xs font-semibold text-foreground">
            {scopeLabel}
          </p>
        </div>
      ) : null}
      {loading ? (
        <div
          className="absolute inset-0 z-[480] flex items-center justify-center bg-background/40 backdrop-blur-[1px]"
          aria-live="polite"
        >
          <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
            Updating map…
          </div>
        </div>
      ) : null}
      <MapContainer
        ref={mapRef}
        center={[30.5, 69.5]}
        zoom={5}
        minZoom={5}
        maxZoom={12}
        maxBounds={MAP_MAX_BOUNDS_LEAFLET}
        maxBoundsViscosity={1.0}
        className={`w-full rounded-[inherit] ${heightClass}`}
        scrollWheelZoom
        whenReady={onReady}
      >
        <TileLayer
          attribution={lightBasemap ? CARTO_ATTRIBUTION : TILE_ATTRIBUTION}
          url={lightBasemap ? CARTO_LIGHT_TILES : ESRI_WORLD_STREET_TILES}
        />
        <ZoomControl position="bottomright" />
        <MapViewBounds points={points} ready={!loading} />
        <GeoJSON
          data={pakistanOutline}
          style={{
            color: "#94a3b8",
            weight: 1,
            fillColor: "#64748b",
            fillOpacity: 0.06,
            opacity: 0.7,
          }}
        />
        <GeoJSON
          data={punjabPkBoundary}
          style={{
            color: "#047857",
            weight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.12,
            opacity: 0.9,
          }}
        />
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={createTeardropPinIcon(p)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.uid}</div>
                <div className="text-muted-foreground">
                  {[p.village, p.tehsil].filter(Boolean).join(" · ")}
                </div>
                {p.approximate ? (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    Approximate position — add GPS on the system record.
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <MapLegend compact={compact} />
    </div>
  );
}

type SystemsMapCardProps = {
  mapFilters: SystemsMapFilters;
  summaryCounts?: { water: number; solar: number } | null | undefined;
  /** Shorter preview with expand-to-fullscreen option (COO dashboard). */
  compact?: boolean;
  /** Human-readable scope — shown on map and kept in sync with KPI filters. */
  scopeLabel?: string | undefined;
  /** Parent KPI reload in progress — badge counts stay on summary values. */
  dataSyncing?: boolean;
};

export default function SystemsMapCard({
  mapFilters,
  summaryCounts,
  compact = false,
  scopeLabel,
  dataSyncing = false,
}: SystemsMapCardProps) {
  const mapRef = useRef<L.Map | null>(null);
  const expandedMapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [registryTotals, setRegistryTotals] = useState({ water: 0, solar: 0 });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = mapListQuery(mapFilters);
      const [waterResult, solarResult] = await Promise.allSettled([
        getWaterSystems(q),
        getSolarSystems(q),
      ]);

      const waterRaw =
        waterResult.status === "fulfilled" ? waterResult.value : null;
      const solarRaw =
        solarResult.status === "fulfilled" ? solarResult.value : null;

      if (waterResult.status === "rejected") {
        toast.error(
          getApiErrorMessage(
            waterResult.reason,
            "Failed to load water systems for map",
          ),
        );
      }
      if (solarResult.status === "rejected") {
        toast.error(
          getApiErrorMessage(
            solarResult.reason,
            "Failed to load solar systems for map",
          ),
        );
      }

      const water =
        waterRaw != null
          ? (normalizeListPayload(waterRaw) as WaterSystemRow[])
          : [];
      const solar =
        solarRaw != null
          ? (normalizeListPayload(solarRaw) as SolarSystemRow[])
          : [];

      setRegistryTotals({ water: water.length, solar: solar.length });

      const mapped: GeoPoint[] = [];

      for (const w of water) {
        const { lat, lng } = rowLatLng(w as unknown as Record<string, unknown>);
        const hasGeo = lat != null && lng != null;
        const { latitude, longitude } = hasGeo
          ? { latitude: lat, longitude: lng }
          : approximateLatLng(`water|${w.id}|${w.tehsil}|${w.village}`, "water");
        mapped.push({
          id: `water-${w.id}`,
          type: "water",
          uid: String(w.unique_identifier ?? w.id),
          tehsil: String(w.tehsil ?? ""),
          village: String(w.village ?? ""),
          latitude,
          longitude,
          approximate: !hasGeo,
        });
      }

      for (const s of solar) {
        const { lat, lng } = rowLatLng(s as unknown as Record<string, unknown>);
        const hasGeo = lat != null && lng != null;
        const { latitude, longitude } = hasGeo
          ? { latitude: lat, longitude: lng }
          : approximateLatLng(`solar|${s.id}|${s.tehsil}|${s.village}`, "solar");
        mapped.push({
          id: `solar-${s.id}`,
          type: "solar",
          uid: String(s.unique_identifier ?? s.id),
          tehsil: String(s.tehsil ?? ""),
          village: String(s.village ?? ""),
          latitude,
          longitude,
          approximate: !hasGeo,
        });
      }

      setPoints(mapped);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load systems for map"));
      setPoints([]);
      setRegistryTotals({ water: 0, solar: 0 });
    } finally {
      setLoading(false);
    }
  }, [mapFilters.tehsil, mapFilters.village]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const id = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(id);
  }, [loading]);

  useEffect(() => {
    if (!expanded || loading) return;
    const id = requestAnimationFrame(() => {
      expandedMapRef.current?.invalidateSize();
    });
    return () => cancelAnimationFrame(id);
  }, [expanded, loading, points]);

  const badgeCounts = useMemo(() => {
    if (summaryCounts != null) {
      return { water: summaryCounts.water, solar: summaryCounts.solar };
    }
    return { water: registryTotals.water, solar: registryTotals.solar };
  }, [summaryCounts, registryTotals.water, registryTotals.solar]);

  const mapBusy = loading || dataSyncing;

  const onMapReady = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize());
  }, []);

  const onExpandedMapReady = useCallback(() => {
    requestAnimationFrame(() => expandedMapRef.current?.invalidateSize());
  }, []);

  const previewHeight = compact
    ? "h-full min-h-[260px] flex-1"
    : "h-[480px]";

  return (
    <>
      <Card className="flex h-full min-h-[320px] flex-col overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 border-b border-border/40 bg-muted/20 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">
              {compact ? "Geographic distribution" : "Map of sites"}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {compact
                ? "Sites in the selected tehsil / village — counts match the footprint panel."
                : "Water (blue) and solar (amber) in scope. Dashed pins are approximate until GPS is saved."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Badge
              variant="outline"
              className={`gap-1 px-2 py-0 text-xs ${mapBusy ? "opacity-60" : ""}`}
            >
              <Droplets className="size-3 text-blue-600" />
              {mapBusy ? "…" : badgeCounts.water}
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1 px-2 py-0 text-xs ${mapBusy ? "opacity-60" : ""}`}
            >
              <Sun className="size-3 text-amber-600" />
              {mapBusy ? "…" : badgeCounts.solar}
            </Badge>
            {compact ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => setExpanded(true)}
                aria-label="Expand map"
              >
                <Maximize2 className="size-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void load()}
                disabled={loading}
              >
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
          <SystemsMapCanvas
            mapRef={mapRef}
            points={points}
            loading={loading}
            heightClass={previewHeight}
            onReady={onMapReady}
            scopeLabel={scopeLabel}
            compact={compact}
            lightBasemap={compact}
          />
          {!compact ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Basemap © Esri. Boundaries from Natural Earth.
            </p>
          ) : null}
          {!mapBusy && badgeCounts.water + badgeCounts.solar === 0 ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              No sites in this scope — adjust tehsil or village in the filter bar
              above.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {compact ? (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent
            className="flex max-h-[92vh] w-[min(96vw,1100px)] max-w-none flex-col gap-3 p-4 sm:p-5"
            showCloseButton
          >
            <DialogHeader>
              <DialogTitle>Programme site map</DialogTitle>
              <DialogDescription>
                {scopeLabel
                  ? `Showing ${scopeLabel}. Scroll to zoom · click pins for details.`
                  : "Water (blue) and solar (amber) for the current scope."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Droplets className="size-3.5 text-blue-600" /> Water:{" "}
                  {badgeCounts.water}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Sun className="size-3.5 text-amber-600" /> Solar:{" "}
                  {badgeCounts.solar}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </div>
              <SystemsMapCanvas
                mapRef={expandedMapRef}
                points={points}
                loading={loading}
                heightClass="h-[min(68vh,560px)]"
                onReady={onExpandedMapReady}
                scopeLabel={scopeLabel}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
