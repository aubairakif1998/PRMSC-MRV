import type { UserRole } from "../constants/roles";

export type { UserRole };

export type AuthUser = {
  id: string;
  name: string;
  role: UserRole;
  /** Tehsils this portal user may access (`user_tehsils` / assignment). */
  tehsils: string[];
  /** Optional: water system UUIDs when the API returns them (e.g. onboarded field accounts). */
  water_system_ids?: string[];
};

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    role: string;
    tehsils?: string[] | null;
    manager_operation_tehsils?: string[] | null;
    water_system_ids?: string[] | null;
  };
};
