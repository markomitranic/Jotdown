import type React from "react";
import { cn } from "cn";

/**
 * The strip above the article that the editor talks to you through.
 *
 * They share this markup so a reader learns one shape once, and so the tone
 * colours are decided in one place.
 *
 * `alert` is for the ones that interrupt, which a screen reader is told about
 * immediately. Progress and success are polite.
 */

export type Tone = "progress" | "done" | "warn" | "error";

/** The left rail's colour, which is the only thing a tone changes. */
const RAIL: Record<Tone, string> = {
  progress: "border-l-primary",
  done: "border-l-success",
  warn: "border-l-warning",
  error: "border-l-destructive",
};

export function Banner({
  tone,
  pulse,
  alert,
  children,
}: {
  tone: Tone;
  pulse?: boolean;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex items-start gap-3 rounded-lg border border-border border-l-3 bg-card p-4 text-sm",
        RAIL[tone],
      )}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      {pulse && <Pulse className="mt-1.5" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The breathing dot that says something is still happening.
 *
 * @example <Pulse className="mt-1.5" />
 */
export function Pulse({ className }: { className?: string }) {
  return (
    <span className={cn("size-2 shrink-0 animate-breathe rounded-full bg-primary", className)} aria-hidden="true" />
  );
}
