import preview from "@/.storybook/preview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@jotdown/core/components/ui/select";

const meta = preview.meta({
  title: "UI/Select",
  component: Select,
  parameters: { layout: "padded" },
  args: { defaultOpen: false },
  render: ({ defaultOpen }) => (
    <Select defaultOpen={defaultOpen} defaultValue="bun">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Package manager" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Package manager</SelectLabel>
          <SelectItem value="bun">bun</SelectItem>
          <SelectItem value="npm">npm</SelectItem>
          <SelectItem value="pnpm">pnpm</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="yarn" disabled>
          yarn
        </SelectItem>
      </SelectContent>
    </Select>
  ),
});

export const Closed = meta.story();

export const Open = meta.story({ args: { defaultOpen: true } });
