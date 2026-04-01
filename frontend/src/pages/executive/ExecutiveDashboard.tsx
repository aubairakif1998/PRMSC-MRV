import ProgramDashboard from "./ProgramDashboard";
import { roleDisplayLabel } from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";

/**
 * MRV COO (SYSTEM_ADMIN) & Manager Operations (SUPER_ADMIN) —
 * organization-wide KPI across all tehsils.
 */
const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const subtitle = roleDisplayLabel(user?.role);

  return (
    <ProgramDashboard
      headingTitle="Organization overview"
      headingDescription={`All tehsils — water, solar, and program KPIs. Signed in as ${subtitle}.`}
    />
  );
};

export default ExecutiveDashboard;
