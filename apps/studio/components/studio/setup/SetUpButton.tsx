"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { openSetup } from "./store";

/**
 * Opens the setup wizard on the repository on screen.
 *
 * @example <SetUpButton projectKey="you/site" />
 */
export function SetUpButton({ projectKey }: { projectKey: string }) {
  return (
    <Button onClick={() => openSetup({ kind: "github", key: projectKey })}>
      Set up docs here
      <ArrowRight data-icon="inline-end" />
    </Button>
  );
}
