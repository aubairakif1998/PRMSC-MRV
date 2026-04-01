import TubewellSubmissionsHub from "./TubewellSubmissionsHub";

/**
 * Legacy wrapper kept for backward compatibility.
 * Tehsil submissions are water/tubewell-only and are implemented in `TubewellSubmissionsHub`.
 */
export default function OperatorSubmissions() {
  return <TubewellSubmissionsHub />;
}
