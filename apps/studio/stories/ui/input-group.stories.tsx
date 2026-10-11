import { ArrowUp, Search } from "lucide-react";
import preview from "@/.storybook/preview";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@jotdown/core/components/ui/input-group";
import { Kbd, KbdGroup } from "@jotdown/core/components/ui/kbd";

const meta = preview.meta({
  title: "UI/Input group",
  component: InputGroup,
  parameters: { layout: "padded" },
});

export const WithIcon = meta.story({
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search releases" />
    </InputGroup>
  ),
});

export const Composer = meta.story({
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupTextarea
        rows={1}
        placeholder="Reply"
        defaultValue="Checked, ours says 3%."
        className="min-h-9 text-sm"
      />
      <InputGroupAddon align="block-end" className="justify-end gap-1.5">
        <KbdGroup className="me-auto">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </KbdGroup>
        <InputGroupButton size="xs">Cancel</InputGroupButton>
        <InputGroupButton variant="default" size="icon-xs" aria-label="Send" className="rounded-full">
          <ArrowUp />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
});
