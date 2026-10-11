import type { ReactNode } from "react";

/**
 * A numbered procedure: a rail down the left with each step's number on it.
 *
 * The numbers are a CSS counter, so a step never says its own. Adapted from
 * Fumadocs UI, MIT.
 *
 * @example <Steps><Step>…</Step><Step>…</Step></Steps>
 */
export function Steps({ children }: { children: ReactNode }) {
  return <div className="jd-steps">{children}</div>;
}

/** One step of a procedure. */
export function Step({ children }: { children: ReactNode }) {
  return <div className="jd-step">{children}</div>;
}
