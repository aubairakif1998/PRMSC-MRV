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
      headingDescription={`See how water and solar programmes are performing across all tehsils—sites on the ground, volumes and run time, and solar import and export. Signed in as ${subtitle}.`}
      managementView
    />
  );
};

export default ExecutiveDashboard;
