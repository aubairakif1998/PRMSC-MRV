import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  Droplets,
  Zap,
  ShieldCheck,
  Database,
} from "lucide-react";
import { useOperatorApi } from "../../hooks";
import { motion } from "framer-motion";
import { getApiErrorMessage } from "../../lib/api-error";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { FormStepper } from "../../components/ui/form-stepper";
import { Spinner } from "../../components/ui/spinner";

const MVRDataEntry = () => {
  const { getWaterDrafts, getSolarDrafts } = useOperatorApi();
  const navigate = useNavigate();
  const [waterDrafts, setWaterDrafts] = useState([]);
  const [solarDrafts, setSolarDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workflowStep, setWorkflowStep] = useState(1);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const [waterRes, solarRes] = await Promise.all([
        getWaterDrafts(),
        getSolarDrafts(),
      ]);
      setWaterDrafts(waterRes.drafts || []);
      setSolarDrafts(solarRes.drafts || []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to load draft records"));
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      id: "water",
      title: "Hydro-Informatics",
      tagline: "Water Management",
      description:
        "Log flow meter diagnostics, pump efficiency metrics, and depth readings.",
      icon: Droplets,
      color: "#0ea5e9",
      secondary: "#0284c7",
      drafts: waterDrafts,
      createPath: "/operator/water-system/new",
      draftsPath: "/operator/water-drafts",
      dataPath: "/operator/water-data",
    },
    {
      id: "solar",
      title: "Photo-Voltaic Logs",
      tagline: "Energy Generation",
      description:
        "Record solar yield, inverter efficiency, and grid consumption analytics.",
      icon: Zap,
      color: "#f59e0b",
      secondary: "#d97706",
      drafts: solarDrafts,
      createPath: "/operator/solar-system/new",
      draftsPath: "/operator/solar-drafts",
      dataPath: "/operator/solar-data",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-md">
            <Database className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Data Collection Terminal
            </h1>
            <p className="text-sm text-slate-600 md:text-base">
              Start a reporting cycle or continue pending drafts.
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="flex items-center gap-3 py-8">
              <Spinner className="size-5 text-slate-500" />
              <p className="text-sm text-slate-600">Loading your draft records...</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {cards.map((card, idx) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <Card className="rounded-2xl border-slate-200">
                <CardHeader>
                  <div className="mb-2 flex items-start justify-between">
                    <div
                      className="rounded-xl p-3"
                      style={{ backgroundColor: `${card.color}20` }}
                    >
                      <card.icon className="size-6" style={{ color: card.color }} />
                    </div>
                    <Badge variant="outline">{card.tagline}</Badge>
                  </div>
                  <CardTitle className="text-xl font-extrabold text-slate-900">
                    {card.title}
                  </CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button
                    className="h-10 gap-2 text-white"
                    style={{ backgroundColor: card.color }}
                    onClick={() => navigate(card.createPath)}
                  >
                    <Plus className="size-4" />
                    Register New Facility
                  </Button>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-10 justify-between"
                      onClick={() => navigate(card.draftsPath)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileText className="size-4" />
                        Resume Drafts
                      </span>
                      <Badge variant="secondary">{card.drafts.length}</Badge>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 gap-2"
                      onClick={() => navigate(card.dataPath)}
                    >
                      <Zap className="size-4" />
                      Submissions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <FormStepper
          steps={[
            { id: 1, label: "Register Facility", hint: "Create or update infrastructure details" },
            { id: 2, label: "Fill Monthly Data", hint: "Enter water or solar period values" },
            { id: 3, label: "Submit for Review", hint: "Publish drafts to verification queue" },
          ]}
          currentStep={workflowStep}
          onStepClick={setWorkflowStep}
        />

        <Card className="rounded-2xl border-blue-100 bg-blue-50/70">
          <CardContent className="flex items-start gap-3 py-5">
            <div className="rounded-lg bg-white p-2 shadow-sm">
              <ShieldCheck className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Operational Compliance Protocol</p>
              <p className="text-sm text-blue-800">
                Entries are timestamped and routed for analyst verification before final MRV acceptance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MVRDataEntry;
