import type { ReactNode } from "react";
import { cn } from "cn";

/** A key as the palette's footer names it. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-px font-sans text-[0.6875rem]">{children}</kbd>
  );
}

/** The label above a group of rows. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-2 pb-1 font-medium text-muted-foreground text-xs">{children}</p>;
}

/** A line of explanation among the rows, read out at once when it is an alert. */
export function Note({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <p
      role={alert ? "alert" : undefined}
      className={cn("px-2.5 py-2", alert ? "text-destructive" : "text-muted-foreground")}
    >
      {children}
    </p>
  );
}
