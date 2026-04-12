import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Droplets, Sun } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
  /** True when API had no lat/lng — pin is a stable placeholder inside Pakistan until coordinates are saved. */
  approximate?: boolean;
};

/** Same tehsil/village scope as Program Dashboard filters (and `/dashboard/program-summary`). */
export type SystemsMapFilters = {
  tehsil: string;
  village: string;
};

/** [west, south], [east, north] in lng/lat — same as previous MapLibre bounds. */
const PAKISTAN_VIEW_BOUNDS_LNGLAT: [[number, number], [number, number]] = [
  [60.45, 23.25],
  [78.05, 37.25],
];

/** Leaflet maxBounds: [[south, west], [north, east]] in lat/lng */
const MAP_MAX_BOUNDS_LEAFLET: L.LatLngBoundsExpression = [
  [21.5, 58.0],
  [39.0, 80.5],
];

/** Esri World Street Map — not the OSM.org tile endpoint; good general-purpose basemap. */
const ESRI_WORLD_STREET_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA';

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

/**
 * Stable fallback inside Pakistan when the registry has no coordinates yet (often solar).
 * Spread so multiple systems in one village don't stack on one pixel.
 */
function approximateLatLng(seed: string, type: "water" | "solar"): { latitude: number; longitude: number } {
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

/** Fit to markers when the filter returns points; otherwise Pakistan overview. */
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

type SystemsMapCardProps = {
  mapFilters: SystemsMapFilters;
  /** Same numbers as the Program Dashboard summary cards (scoped by tehsil/village). `null` while parent loads. */
  summaryCounts?: { water: number; solar: number } | null | undefined;
};

export default function SystemsMapCard({ mapFilters, summaryCounts }: SystemsMapCardProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  /** Row counts from the last list API response (matches filter scope). */
  const [registryTotals, setRegistryTotals] = useState({ water: 0, solar: 0 });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = mapListQuery(mapFilters);
      const [waterResult, solarResult] = await Promise.allSettled([
        getWaterSystems(q),
        getSolarSystems(q),
      ]);

      const waterRaw = waterResult.status === "fulfilled" ? waterResult.value : null;
      const solarRaw = solarResult.status === "fulfilled" ? solarResult.value : null;

      if (waterResult.status === "rejected") {
        toast.error(getApiErrorMessage(waterResult.reason, "Failed to load water systems for map"));
      }
      if (solarResult.status === "rejected") {
        toast.error(getApiErrorMessage(solarResult.reason, "Failed to load solar systems for map"));
      }

      const water = waterRaw != null ? (normalizeListPayload(waterRaw) as WaterSystemRow[]) : [];
      const solar = solarRaw != null ? (normalizeListPayload(solarRaw) as SolarSystemRow[]) : [];

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

  const badgeCounts = useMemo(() => {
    if (summaryCounts != null) {
      return { water: summaryCounts.water, solar: summaryCounts.solar };
    }
    return { water: registryTotals.water, solar: registryTotals.solar };
  }, [summaryCounts, registryTotals.water, registryTotals.solar]);

  const mapPins = points;

  const onMapReady = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.invalidateSize());
  }, []);

  return (
    <Card className="border-border/80 !overflow-visible">
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Map of sites</CardTitle>
          <CardDescription>
            Water (blue) and solar (amber) sites in your filter, on Punjab (green outline) and Pakistan.
            Counts match &quot;Sites on programme&quot; above. Dashed pins mean the map position is
            approximate until GPS is saved on the record.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Droplets className="size-3.5 text-blue-600" /> Water:{" "}
            {badgeCounts.water}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Sun className="size-3.5 text-amber-600" /> Solar: {badgeCounts.solar}
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
      </CardHeader>
      <CardContent className="space-y-0 overflow-visible px-4">
        <div className="relative h-[480px] w-full min-w-0 overflow-visible rounded-xl border bg-muted/10 [&_.leaflet-container]:z-0">
          {loading ? (
            <div
              className="absolute left-3 top-3 z-[500] rounded-md border bg-background/95 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm"
              aria-live="polite"
            >
              Loading systems…
            </div>
          ) : null}
          <MapContainer
            ref={mapRef}
            center={[30.5, 69.5]}
            zoom={5}
            minZoom={4}
            maxZoom={15}
            maxBounds={MAP_MAX_BOUNDS_LEAFLET}
            maxBoundsViscosity={0.85}
            className="h-[480px] w-full rounded-[inherit]"
            scrollWheelZoom
            whenReady={onMapReady}
          >
            <TileLayer
              attribution={TILE_ATTRIBUTION}
              url={ESRI_WORLD_STREET_TILES}
            />
            <ZoomControl position="bottomright" />
            <MapViewBounds points={mapPins} ready={!loading} />

            <GeoJSON
              data={pakistanOutline}
              style={{
                color: "#94a3b8",
                weight: 1.2,
                fillColor: "#64748b",
                fillOpacity: 0.1,
                opacity: 0.85,
              }}
            />
            <GeoJSON
              data={punjabPkBoundary}
              style={{
                color: "#047857",
                weight: 2.5,
                fillColor: "#10b981",
                fillOpacity: 0.2,
                opacity: 1,
              }}
            />

            {mapPins.map((p) => (
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
                        Approximate map position — add latitude/longitude on the system record for GPS accuracy.
                      </p>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Basemap tiles © Esri (World Street). Pakistan outline and Punjab
          province boundary from{" "}
          <a
            href="https://www.naturalearthdata.com/"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
          </a>{" "}
          (public domain).
        </p>
        {badgeCounts.water + badgeCounts.solar === 0 && !loading ? (
          <div className="mt-3 rounded-xl border bg-muted/10 p-3 text-sm text-muted-foreground">
            No water or solar systems in scope for this filter. Widen tehsil/village or register systems for
            these locations.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
