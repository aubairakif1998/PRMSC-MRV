import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ShimmerProps = ComponentProps<"div"> & {
  /** When true, applies the animated shimmer sweep overlay. */
  active?: boolean;
};

/** Block placeholder with optional shimmer sweep — use for loading states. */
function Shimmer({ className, active = true, ...props }: ShimmerProps) {
  return (
    <div
      data-slot="shimmer"
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/80",
        className,
      )}
      {...props}
    >
      {active ? (
        <div
          className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export { Shimmer };
