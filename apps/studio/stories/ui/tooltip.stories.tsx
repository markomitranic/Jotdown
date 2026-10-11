import { Settings } from "lucide-react";
import preview from "@/.storybook/preview";
import { Button } from "@jotdown/core/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";

const meta = preview.meta({
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  render: () => (
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <Settings />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Settings · Coming soon</TooltipContent>
    </Tooltip>
  ),
});

export const Open = meta.story();
