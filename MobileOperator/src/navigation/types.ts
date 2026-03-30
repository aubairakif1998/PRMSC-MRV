export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  WaterSystemRegister: undefined;
  SolarSystemRegister: undefined;
  /** Monthly log — enter location on the form, or open from Quick log with systemId. */
  WaterLog:
    | {
        draftId?: string;
        systemId?: string | number;
        /** Shown in header when opened from Quick log */
        facilityLabel?: string;
      }
    | undefined;
  SolarLog:
    | {
        draftId?: string;
        systemId?: string | number;
        facilityLabel?: string;
      }
    | undefined;
  /** List registered facilities, then open log with location prefilled. */
  PickFacility: { kind: 'water' | 'solar' };
  Drafts: undefined;
  MySubmissions: undefined;
  SubmissionDetail: { submissionId: string };
};
