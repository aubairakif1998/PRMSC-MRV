import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrainCircuit, Loader2, Play, RefreshCcw } from "lucide-react";
import { useAnalystApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Skeleton } from "../../components/ui/skeleton";

type TabType = "water" | "solar" | "grid";
type PredictionPoint = { month: number; year: number; value?: number; predicted_value?: number };
type PredictionResponse = {
  message?: string;
  filter?: { tehsil?: string | null; village?: string | null };
  historical?: PredictionPoint[];
  predictions?: PredictionPoint[];
};
type LocationsResponse = { tehsils: string[]; villages: string[] };
type AllPredictionResponse = {
  water_demand?: { has_data?: boolean; predictions?: PredictionPoint[]; error?: string };
  solar_generation?: { has_data?: boolean; predictions?: PredictionPoint[]; error?: string };
  grid_consumption?: { has_data?: boolean; predictions?: PredictionPoint[]; error?: string };
};

const predictionValue = (row: PredictionPoint) => row.value ?? row.predicted_value ?? null;

const PredictionDashboard = () => {
  const {
    getPredictionLocations,
    getWaterDemandPredictions,
    getSolarGenerationPredictions,
    getGridConsumptionPredictions,
    getAllPredictions,
    trainPredictionModels,
  } = useAnalystApi();

  const [activeTab, setActiveTab] = useState<TabType>("water");
  const [months, setMonths] = useState("6");
  const [tehsil, setTehsil] = useState("");
  const [village, setVillage] = useState("");
  const [locations, setLocations] = useState<LocationsResponse>({ tehsils: [], villages: [] });
  const [prediction, setPrediction] = useState<PredictionResponse>({});
  const [allPrediction, setAllPrediction] = useState<AllPredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [trainMsg, setTrainMsg] = useState("");

  const loadLocations = async () => {
    const data = (await getPredictionLocations()) as LocationsResponse;
    setLocations(data || { tehsils: [], villages: [] });
  };

  const loadSinglePrediction = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        months: Number(months),
        tehsil: tehsil || undefined,
        village: village || undefined,
      };
      const data =
        activeTab === "water"
          ? ((await getWaterDemandPredictions(payload)) as PredictionResponse)
          : activeTab === "solar"
            ? ((await getSolarGenerationPredictions(payload)) as PredictionResponse)
            : ((await getGridConsumptionPredictions(payload)) as PredictionResponse);
      setPrediction(data || {});
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load predictions"));
      setPrediction({});
    } finally {
      setLoading(false);
    }
  };

  const loadAllPrediction = async () => {
    try {
      const data = (await getAllPredictions({
        months: Number(months),
        tehsil: tehsil || undefined,
        village: village || undefined,
      })) as AllPredictionResponse;
      setAllPrediction(data || null);
    } catch {
      setAllPrediction(null);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadLocations();
      await loadSinglePrediction();
      await loadAllPrediction();
    };
    void run();
  }, []);

  useEffect(() => {
    void loadSinglePrediction();
    void loadAllPrediction();
  }, [activeTab, months, tehsil, village]);

  const chartData = useMemo(() => {
    const historical = prediction.historical || [];
    const predicted = prediction.predictions || [];
    return [
      ...historical.map((h) => ({
        period: `${h.month}/${h.year}`,
        historical: predictionValue(h),
        predicted: null as number | null,
      })),
      ...predicted.map((p) => ({
        period: `${p.month}/${p.year}`,
        historical: null as number | null,
        predicted: predictionValue(p),
      })),
    ];
  }, [prediction]);

  const runTraining = async () => {
    setTraining(true);
    setTrainMsg("");
    try {
      const data = (await trainPredictionModels({
        tehsil: tehsil || undefined,
        village: village || undefined,
      })) as { message?: string; trained_at?: string };
      setTrainMsg(data?.message ? `${data.message}${data.trained_at ? ` (${data.trained_at})` : ""}` : "Model training completed");
      await loadSinglePrediction();
      await loadAllPrediction();
    } catch (err) {
      setTrainMsg(getApiErrorMessage(err, "Model training failed"));
    } finally {
      setTraining(false);
    }
  };

  const unitLabel = activeTab === "water" ? "m3" : "kWh";

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <BrainCircuit className="size-5 text-primary" />
              Prediction Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Forecast water demand, solar generation, and grid consumption.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadSinglePrediction()}>
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Button onClick={() => void runTraining()} disabled={training}>
              {training ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Retrain Models
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Prediction APIs: `/api/predictions/*`</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select value={tehsil || "__all_tehsil__"} onValueChange={(v) => setTehsil(v === "__all_tehsil__" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All tehsils" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_tehsil__">All Tehsils</SelectItem>
                {locations.tehsils.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={village || "__all_village__"} onValueChange={(v) => setVillage(v === "__all_village__" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All villages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_village__">All Villages</SelectItem>
                {locations.villages.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{tehsil || "All Tehsils"}</Badge>
              <Badge variant="outline">{village || "All Villages"}</Badge>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
        {trainMsg ? (
          <Card>
            <CardContent className="pt-6 text-sm">{trainMsg}</CardContent>
          </Card>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="water">Water Demand</TabsTrigger>
            <TabsTrigger value="solar">Solar Generation</TabsTrigger>
            <TabsTrigger value="grid">Grid Consumption</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>{activeTab} Forecast</CardTitle>
                  <CardDescription>
                    Historical + predicted values ({unitLabel})
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="h-[360px] min-w-[680px]">
                    {loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="historical" stroke="#3b82f6" strokeWidth={2.5} />
                          <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5 5" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Predicted Points</CardTitle>
                  <CardDescription>Upcoming {Number(months)} month(s)</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[360px] space-y-2 overflow-auto">
                  {(prediction.predictions || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{prediction.message || "No forecast data available."}</p>
                  ) : (
                    (prediction.predictions || []).map((p, idx) => (
                      <div key={`${p.year}-${p.month}-${idx}`} className="rounded-lg border p-3">
                        <div className="text-sm font-medium">
                          {p.month}/{p.year}
                        </div>
                        <div className="text-xs text-muted-foreground">{(predictionValue(p) ?? 0).toLocaleString()} {unitLabel}</div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>All Models Snapshot</CardTitle>
            <CardDescription>From `POST /api/predictions/all`</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {([
              { key: "water_demand", label: "Water Demand" },
              { key: "solar_generation", label: "Solar Generation" },
              { key: "grid_consumption", label: "Grid Consumption" },
            ] as const).map((section) => {
              const item = allPrediction?.[section.key];
              return (
                <div key={section.key} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item?.has_data
                      ? `${item.predictions?.length || 0} prediction points`
                      : item?.error || "No data"}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PredictionDashboard;
