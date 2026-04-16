/** Tehsil Manager Operator (ADMIN) portal paths. */
export const TEHSIL_BASE = "/tehsil" as const;

export const tehsilRoutes = {
  dashboard: TEHSIL_BASE,
  onboardOperator: `${TEHSIL_BASE}/onboard-operator`,
  /** View and edit which water systems each tubewell operator may log (in your tehsil). */
  operatorAssignments: `${TEHSIL_BASE}/operator-assignments`,
  waterSystems: `${TEHSIL_BASE}/water-systems`,
  waterSubmissions: `${TEHSIL_BASE}/submissions`,
  waterSubmissionDetails: (id: string) =>
    `${TEHSIL_BASE}/submissions/${encodeURIComponent(id)}/details`,
  waterForm: `${TEHSIL_BASE}/water-form`,
  waterFormEdit: (waterSystemKey: string) =>
    `${TEHSIL_BASE}/water-form/${encodeURIComponent(waterSystemKey)}/edit`,
  waterData: `${TEHSIL_BASE}/water-data`,
  solarSites: `${TEHSIL_BASE}/solar-sites`,
  solarSiteEdit: (systemId: string) =>
    `${TEHSIL_BASE}/solar-sites/${encodeURIComponent(systemId)}/edit`,
  solarForm: `${TEHSIL_BASE}/solar-form`,
  solarEnergy: `${TEHSIL_BASE}/solar-energy-data`,
  /** Create a new monthly log (form never pre-fills an existing month). */
  solarEnergyAdd: `${TEHSIL_BASE}/solar-energy-data/add`,
  /** Edit a single monthly solar log by its `solar_energy_logging_monthly` id */
  solarEnergyEdit: (recordId: string) =>
    `${TEHSIL_BASE}/solar-energy-data/${encodeURIComponent(recordId)}`,
  // solarSubmissions: `${TEHSIL_BASE}/solar-submissions`,
  /** Tubewell daily + solar monthly logging compliance (tehsil manager). */
  loggingCompliance: `${TEHSIL_BASE}/logging-compliance`,
  /** Water-only compliance view (tehsil manager). */
  waterLoggingCompliance: `${TEHSIL_BASE}/logging-compliance/water`,
  /** Solar-only compliance view (tehsil manager). */
  solarLoggingCompliance: `${TEHSIL_BASE}/logging-compliance/solar`,
  /** Aggregated monthly logs across all registered solar sites (tehsil manager). */
  solarMonthlyLogging: `${TEHSIL_BASE}/solar-monthly-logging`,
  solarMonthlyLogEdit: (recordId: string) =>
    `${TEHSIL_BASE}/solar-monthly-logging/${encodeURIComponent(recordId)}/edit`,
  submissionReview: (id: string) => `${TEHSIL_BASE}/review/${id}`,
} as const;

/** MRV COO & Manager Operations — organization-wide KPI. */
export const HQ_DASHBOARD = "/hq";

/** Public auth flows */
export const authRoutes = {
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
} as const;

/** Authenticated account flows (all portal roles) */
export const accountRoutes = {
  changePassword: "/account/change-password",
} as const;
