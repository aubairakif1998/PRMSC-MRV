export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
  /** Backend role code, e.g. USER/ADMIN/SUPER_ADMIN/SYSTEM_ADMIN */
  role: string;
  /** For tubewell operators, backend provides assigned system IDs */
  water_system_ids?: string[] | null;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
