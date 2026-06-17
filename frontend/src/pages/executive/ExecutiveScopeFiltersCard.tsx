import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXECUTIVE_MONTHS,
  EXECUTIVE_YEARS,
  type ExecutiveScopeFilters,
} from "./executiveAnalysisTypes";

type ExecutiveScopeFiltersCardProps = {
  filters: ExecutiveScopeFilters;
  activeScopeLabel: string;
  allowedTehsils: string[];
  restrictTehsils: boolean;
  villageOptions: string[];
  onUpdate: <K extends keyof ExecutiveScopeFilters>(
    key: K,
    value: ExecutiveScopeFilters[K],
  ) => void;
  onApply: () => void;
};

function ExecutiveScopeFiltersCard({
  filters,
  activeScopeLabel,
  allowedTehsils,
  restrictTehsils,
  villageOptions,
  onUpdate,
  onApply,
}: ExecutiveScopeFiltersCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Scope filters</CardTitle>
        <CardDescription>
          Narrow the analysis by tehsil, village, and reporting period.
        </CardDescription>
        <p className="pt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Active scope:</span>{" "}
          {activeScopeLabel}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={filters.tehsil}
          onValueChange={(v) => onUpdate("tehsil", v ?? filters.tehsil)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tehsil" />
          </SelectTrigger>
          <SelectContent>
            {(restrictTehsils
              ? allowedTehsils
              : ["All Tehsils", ...allowedTehsils]
            ).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.village}
          onValueChange={(v) => onUpdate("village", v ?? filters.village)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Village" />
          </SelectTrigger>
          <SelectContent>
            {villageOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.month}
          onValueChange={(v) => onUpdate("month", v ?? filters.month)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Months">All months</SelectItem>
            {EXECUTIVE_MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.year}
          onValueChange={(v) => onUpdate("year", v ?? filters.year)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {EXECUTIVE_YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onApply} className="w-full">
          Apply filters
        </Button>
      </CardContent>
    </Card>
  );
}

export default memo(ExecutiveScopeFiltersCard);
