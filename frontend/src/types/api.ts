/**
 * Shared shapes aligned with `backend/docs/API_REFERENCE.md`.
 * IDs are UUID strings from the API.
 */

export type WaterSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier?: string;
  latitude?: number | null;
  longitude?: number | null;
  pump_model?: string | null;
  pump_serial_number?: string | null;
  start_of_operation?: string | null;
  depth_of_water_intake?: number | null;
  height_to_ohr?: number | null;
  pump_flow_rate?: number | null;
  bulk_meter_installed?: boolean | null;
  ohr_tank_capacity?: number | null;
  ohr_fill_required?: number | null;
  pump_capacity?: number | null;
  pump_head?: number | null;
  pump_horse_power?: number | null;
  time_to_fill?: number | null;
  meter_model?: string | null;
  meter_serial_number?: string | null;
  meter_accuracy_class?: string | null;
  calibration_requirement?: string | null;
  installation_date?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WaterSystemCalibrationCertificate = {
  id: string;
  water_system_id: string;
  file_url: string;
  uploaded_at?: string | null;
  expiry_date?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SolarSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier?: string;
  latitude?: number | null;
  longitude?: number | null;
  installation_location?: string | null;
  solar_panel_capacity?: number | null;
  inverter_capacity?: number | null;
  inverter_serial_number?: string | null;
  solar_connection_date?: string | null;
  electricity_connection_date?: string | null;
  green_connection_date?: string | null;
  installation_date?: string | null;
  meter_model?: string | null;
  meter_serial_number?: string | null;
  green_meter_connection_date?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  monthly_log_count?: number | null;
};

export type ApiValidationErrorBody = {
  message?: string;
  errors?: string[];
};

/** One row from `GET /operator/solar-supply-data` (list for a site + year). */
export type SolarMonthlySupplyListItem = {
  id: string;
  year: number;
  month: number;
  export_off_peak?: number | null;
  export_peak?: number | null;
  import_off_peak?: number | null;
  import_peak?: number | null;
  net_off_peak?: number | null;
  net_peak?: number | null;
  remarks?: string | null;
  electricity_bill_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** List table row: API row plus site context (attached client-side). */
export type SolarMonthlyLogTableRow = SolarMonthlySupplyListItem & {
  solar_system_id: string;
  tehsil: string;
  village: string;
  settlement: string;
};

/** `GET /operator/solar-supply-data/record/:id` full shape. */
export type SolarMonthlySupplyRecordDetail = SolarMonthlySupplyListItem & {
  solar_system_id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
};
