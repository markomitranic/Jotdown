import { Copy, History, Trash2 } from "lucide-react";
import preview from "@/.storybook/preview";
import { Button } from "@jotdown/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";

const meta = preview.meta({
  title: "UI/Dropdown menu",
  component: DropdownMenu,
  parameters: { layout: "padded" },
  render: () => (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">More for this page</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>This page</DropdownMenuLabel>
        <DropdownMenuItem>
          <Copy /> Copy markdown <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <History /> History
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Open by default</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 /> Delete page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Open = meta.story();
