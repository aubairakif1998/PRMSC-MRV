import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";

import {
  defaultPathForRole,
  EXECUTIVE_ROLES,
  STAFF_ROLES,
  TEHSIL_MANAGER_ROLES,
  isTehsilManager,
} from "./constants/roles";
import OnboardOperator from "./pages/tehsil/onboarding/OnboardOperator";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";

import Login from "./pages/auth/Login";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import ResetPasswordPage from "./pages/auth/ResetPassword";
import ChangePasswordPage from "./pages/account/ChangePassword";

import WaterSystemForm from "./pages/tehsil/water/WaterSystemForm";
import WaterSystemEditPage from "./pages/tehsil/water/systems/WaterSystemEditPage";
import WaterSystems from "./pages/tehsil/water/WaterSystems";
import SolarSites from "./pages/tehsil/solar/SolarSites";
import SolarSystemForm from "./pages/tehsil/solar/SolarSystemForm";
import SolarSiteEditPage from "./pages/tehsil/solar/sites/SolarSiteEditPage";
import SolarMonthlyLogging from "./pages/tehsil/solar/monthly-logging/SolarMonthlyLogging";
import SolarMonthlyLogEditPage from "./pages/tehsil/solar/monthly-logging/SolarMonthlyLogEditPage";
import SolarSupplyDataForm from "./pages/tehsil/solar/SolarSupplyDataForm";
import TubewellSubmissionsHub from "./pages/tehsil/submissions/TubewellSubmissionsHub";
import WaterSubmissionDetailsPage from "./pages/tehsil/submissions/WaterSubmissionDetailsPage";

import ExecutiveDashboard from "./pages/executive/ExecutiveDashboard";
import TehsilManagerDashboard from "./pages/tehsil/dashboard/TehsilManagerDashboard";
import LoggingCompliance from "./pages/tehsil/logging/LoggingCompliance";
import WaterOperatorAssignments from "./pages/tehsil/operators/WaterOperatorAssignments";

import SubmissionsAudit from "./pages/verification/VerificationDashboard";
import SubmissionReview from "./pages/verification/SubmissionReview";
import { tehsilRoutes } from "./constants/routes";

const VerificationsRedirect = () => {
  const { user } = useAuth();
  const role = user?.role ?? null;
  return (
    <Navigate
      to={isTehsilManager(role) ? tehsilRoutes.waterSubmissions : "/submissions"}
      replace
    />
  );
};

/** Legacy bookmarked URLs: `/operator/solar-energy-data/:id` → tehsil edit route */
const LegacyOperatorSolarRecordRedirect = () => {
  const { recordId } = useParams();
  return (
    <Navigate
      to={`/tehsil/solar-energy-data/${recordId ?? ""}`}
      replace
    />
  );
};

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
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultPathForRole(user.role)} replace />;
  }
  return <>{children}</>;
};

function PortalHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#64748b",
        }}
      >
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#64748b",
        }}
      >
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route path="/" element={<RootRedirect />} />

          <Route element={<MainLayout />}>
            <Route
              path="/account/change-password"
              element={
                <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            {/* MRV COO & Manager Operations — org KPI only */}
            <Route
              path="/hq"
              element={
                <ProtectedRoute allowedRoles={[...EXECUTIVE_ROLES]}>
                  <ExecutiveDashboard />
                </ProtectedRoute>
              }
            />

            {/* Tehsil Manager Operator */}
            <Route
              path="/tehsil"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <TehsilManagerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/onboard-operator"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <OnboardOperator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/onboard-operator"
              element={<Navigate to="/tehsil/onboard-operator" replace />}
            />

            <Route
              path="/tehsil/operator-assignments"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterOperatorAssignments />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-systems"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystems />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/submissions/:id/details"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSubmissionDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/submissions"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <TubewellSubmissionsHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-form"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/water-form/:waterSystemKey/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <WaterSystemEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-sites"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSites />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-sites/:systemId/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSiteEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-monthly-logging/:recordId/edit"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarMonthlyLogEditPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-monthly-logging"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarMonthlyLogging />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/logging-compliance"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <LoggingCompliance />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-form"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSystemForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/solar-energy-data/add"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/solar-energy-data/:recordId"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tehsil/solar-energy-data"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SolarSupplyDataForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tehsil/review/:id"
              element={
                <ProtectedRoute allowedRoles={[...TEHSIL_MANAGER_ROLES]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            {/* Submissions & verification — all portal roles; API scopes ADMIN to tehsil */}
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
                <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                  <SubmissionsAudit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions/review/:id"
              element={
                <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                  <SubmissionReview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/verifications"
              element={
                <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
                  <VerificationsRedirect />
                </ProtectedRoute>
              }
            />

            {/* Legacy analyst paths → executive KPI home */}
            <Route path="/analyst" element={<Navigate to="/hq" replace />} />
            <Route path="/analyst/*" element={<Navigate to="/hq" replace />} />

            {/* Legacy operator URLs */}
            <Route path="/operator" element={<PortalHomeRedirect />} />
            <Route
              path="/operator/water-form"
              element={<Navigate to="/tehsil/water-form" replace />}
            />
            <Route
              path="/operator/solar-form"
              element={<Navigate to="/tehsil/solar-form" replace />}
            />
            <Route
              path="/operator/solar-data"
              element={<Navigate to="/tehsil/solar-energy-data" replace />}
            />
            <Route
              path="/operator/solar-energy-data/:recordId"
              element={<LegacyOperatorSolarRecordRedirect />}
            />
            <Route
              path="/operator/solar-energy-data"
              element={<Navigate to="/tehsil/solar-energy-data" replace />}
            />
            <Route
              path="/operator/solar-drafts"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/solar-submissions"
              element={<Navigate to="/tehsil/submissions" replace />}
            />
            <Route
              path="/operator/review/:id"
              element={<Navigate to="/tehsil/review/:id" replace />}
            />
            <Route
              path="/operator/water-data"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-supply-data"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-drafts"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/operator/water-submissions"
              element={<Navigate to="/tehsil" replace />}
            />
            <Route
              path="/mvr-data-entry"
              element={<Navigate to="/tehsil" replace />}
            />

            <Route
              path="/view-submission"
              element={
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-slate-700">
                  <h1 className="text-lg font-semibold text-slate-900">
                    View submission
                  </h1>
                  <p className="mt-2 text-sm">
                    Open a record from Tehsil submissions.
                  </p>
                </div>
              }
            />
          </Route>
        </Routes>
        <Toaster richColors position="top-right" />
      </Router>
    </AuthProvider>
  );
}

export default App;
