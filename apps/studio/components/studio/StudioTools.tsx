"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { useWorkspace } from "./Workspace";
import { RendererMenu } from "./canvas/RendererMenu";

/**
 * The studio's buttons at the foot of the sidebar: settings, and how the project is drawn.
 *
 * Settings is a placeholder until it exists, so a click on it says so instead
 * of doing nothing. Outside the signed-in studio it draws nothing.
 *
 * @example <StudioTools />
 */
export function StudioTools() {
  const workspace = useWorkspace();
  if (!workspace) return null;

  return (
    <>
      <Unbuilt label="Settings">
        <Settings />
      </Unbuilt>
      <RendererMenu />
    </>
  );
}

/**
 * A tool that is not built yet, which answers a click with a tooltip saying so.
 *
 * @example <Unbuilt label="Settings"><Settings /></Unbuilt>
 */
function Unbuilt({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function tell(event: MouseEvent) {
    event.preventDefault();
    setOpen(true);
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-disabled="true"
          className="cursor-default opacity-50 hover:bg-transparent dark:hover:bg-transparent"
          onClick={tell}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label} · Coming soon</TooltipContent>
    </Tooltip>
  );
}
