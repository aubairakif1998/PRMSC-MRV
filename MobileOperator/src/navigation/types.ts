export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  /** Monthly log — opened from assignments picker with `systemId`. */
  WaterLog:
    | {
        draftId?: string;
        systemId?: string | number;
        /** Shown in header when opened from assignments */
        facilityLabel?: string;
      }
    | undefined;
  /** Assigned water systems list (entry point to logging). */
  Assignments: undefined;
  Drafts: undefined;
  Signature: undefined;
  MySubmissions: undefined;
  SubmissionDetail: { submissionId: string };
};
