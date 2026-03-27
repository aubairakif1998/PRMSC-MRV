import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import OperatorDashboard from "./pages/operator/Dashboard";
import WaterSystemForm from "./pages/operator/WaterSystemForm";
import SolarSystemForm from "./pages/operator/SolarSystemForm";
import WaterDataTable from "./pages/operator/WaterDataTable";
import SolarDataTable from "./pages/operator/SolarDataTable";
import MVRDataEntry from "./pages/operator/MVRDataEntry";
import WaterDrafts from "./pages/operator/WaterDrafts";
import SolarDrafts from "./pages/operator/SolarDrafts";
import WaterSupplyDataForm from "./pages/operator/WaterSupplyDataForm";
import SolarSupplyDataForm from "./pages/operator/SolarSupplyDataForm";
import OperatorSubmissions from "./pages/operator/OperatorSubmissions";

import AnalystDashboard from "./pages/analyst/AnalystDashboard";
import EmissionDashboard from "./pages/analyst/EmissionDashboard";
import PredictionDashboard from "./pages/analyst/PredictionDashboard";
import ProgramDashboard from "./pages/analyst/ProgramDashboard";

import SubmissionsAudit from "./pages/verification/VerificationDashboard";
import SubmissionReview from "./pages/verification/SubmissionReview";
import VerificationsPage from "./pages/verification/VerificationsPage";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#818cf8",
        }}
      >
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<MainLayout />}>
            <Route
              path="/operator"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <OperatorDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/water-form"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <WaterSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/solar-form"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <SolarSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/water-data"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <WaterSupplyDataForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/solar-data"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <SolarDataTable />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/solar-energy-data"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/water-submissions"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <OperatorSubmissions submissionType="water_system" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/solar-submissions"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <OperatorSubmissions submissionType="solar_system" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/review/:id"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/mvr-data-entry"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <MVRDataEntry />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/water-supply-data"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <WaterSupplyDataForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/water-drafts"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <WaterDrafts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/solar-drafts"
              element={
                <ProtectedRoute allowedRoles={["operator"]}>
                  <SolarDrafts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/analyst/emissions"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <EmissionDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analyst/prediction"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <PredictionDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analyst/program-dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <ProgramDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/verification"
              element={<Navigate to="/submissions" replace />}
            />
            <Route
              path="/verification/review/:id"
              element={<Navigate to="/submissions/review/:id" replace />}
            />

            <Route
              path="/submissions"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <SubmissionsAudit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions/review/:id"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/verifications"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <VerificationsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/analyst/*"
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "analyst",
                    "environment_manager",
                    "operations_department",
                  ]}
                >
                  <AnalystDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/view-submission"
              element={
                <div style={{ padding: "40px", color: "#fff" }}>
                  <h1 className="gradient-text">View Submission</h1>
                  <p>This page is currently blank.</p>
                </div>
              }
            />
          </Route>

          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </Router>
    </AuthProvider>
  );
}

export default App;
