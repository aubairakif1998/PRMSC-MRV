import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StepItem = {
  id: number;
  label: string;
  hint?: string;
};

type FormStepperProps = {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
};

export function FormStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: FormStepperProps) {
  const progressValue =
    steps.length <= 1 ? 100 : ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("space-y-3 rounded-2xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs font-semibold">
          Step {currentStep} of {steps.length}
        </Badge>
      </div>

      <Progress value={progressValue} />

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full border text-xs",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary text-primary"
                        : "border-muted-foreground/40 text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : step.id}
                </span>
                <span>{step.label}</span>
              </div>
              {step.hint ? (
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

