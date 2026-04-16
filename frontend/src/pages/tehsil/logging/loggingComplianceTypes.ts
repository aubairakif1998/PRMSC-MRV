export type AssignedOperator = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

export type WaterSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
  /** Tubewell operators linked via onboarding (user_water_systems). */
  assigned_operators?: AssignedOperator[];
  daily_status: string;
  daily_log: { record_id: string; status: string } | null;
};

export type SolarSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
  monthly_status: string;
  monthly_log: { record_id: string; has_data: boolean } | null;
};

export type CompliancePayload = {
  water_date: string;
  solar_year: number;
  solar_month: number;
  water_systems: WaterSystemRow[];
  solar_systems: SolarSystemRow[];
};

/** One row per calendar day from `/operator/logging-compliance/water-daily-range`. */
export type WaterDailyRangeDay = {
  date: string;
  daily_status: string;
  daily_log: { record_id: string; status: string } | null;
};

export type WaterDailyRangePayload = {
  water_system_id: string;
  unique_identifier: string;
  village: string;
  tehsil: string;
  settlement?: string | null;
  date_from: string;
  date_to: string;
  assigned_operators?: AssignedOperator[];
  days: WaterDailyRangeDay[];
};

export type WaterSystemListItem = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
};

/** One calendar month from `/operator/logging-compliance/solar-monthly-year`. */
export type SolarMonthlyYearMonthRow = {
  month: number;
  monthly_status: string;
  monthly_log: { record_id: string; has_data: boolean } | null;
};

export type SolarMonthlyYearPayload = {
  solar_system_id: string;
  unique_identifier: string;
  village: string;
  tehsil: string;
  settlement?: string | null;
  year: number;
  months: SolarMonthlyYearMonthRow[];
};

export type SolarSystemListItem = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
};

export const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Short labels for badges (plain English). */
export function waterStatusLabel(status: string): string {
  switch (status) {
    case "missing":
      return "Not entered";
    case "draft":
      return "Draft — not sent";
    case "submitted":
      return "Waiting for your review";
    case "accepted":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "reverted_back":
      return "Sent back to operator";
    default:
      return status;
  }
}

export function waterStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "missing":
      return "destructive";
    case "draft":
      return "secondary";
    case "submitted":
      return "default";
    case "accepted":
      return "outline";
    case "rejected":
      return "destructive";
    case "reverted_back":
      return "secondary";
    default:
      return "outline";
  }
}

export function formatAssignedOperators(ops: AssignedOperator[] | undefined): string {
  if (!ops?.length) return "";
  return ops
    .map((o) => o.name?.trim() || o.email)
    .filter(Boolean)
    .join(", ");
}

/** One line per operator for native tooltip (name, email, phone when present). */
export function formatAssignedOperatorsTitle(
  ops: AssignedOperator[] | undefined,
): string | undefined {
  if (!ops?.length) return undefined;
  const lines = ops.map((o) => {
    const name = o.name?.trim() || o.email;
    const rest = [o.email && o.email !== name ? o.email : null, o.phone]
      .filter(Boolean)
      .join(" · ");
    return rest ? `${name} (${rest})` : name;
  });
  return lines.join("\n");
}

