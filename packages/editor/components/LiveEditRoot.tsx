"use client";

import type { ReactNode } from "react";
import type { LiveEditGlobalData } from "@jotdown/editor/types";
import { LiveEditConfigProvider } from "@jotdown/editor/client/config";
import { StructureProvider } from "@jotdown/editor/structure/useStructure";
import { useReading } from "@jotdown/editor/client/reading";

/**
 * Mounts the editing session around the whole app.
 *
 * Holds the arrangement session above the docs shell, so a staged change
 * survives navigation. The sidebar renders the control only where edits work,
 * which is nowhere while the page is drawn for reading.
 */
export function LiveEditRoot({ config, children }: { config: LiveEditGlobalData; children: ReactNode }) {
  const reading = useReading();

  return (
    <LiveEditConfigProvider config={reading ? { ...config, editable: false } : config}>
      <StructureProvider>{children}</StructureProvider>
    </LiveEditConfigProvider>
  );
}
