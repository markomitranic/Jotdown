import preview from "@/.storybook/preview";
import { Input } from "@jotdown/core/components/ui/input";

const meta = preview.meta({
  title: "UI/Input",
  component: Input,
  parameters: { layout: "padded" },
  args: { placeholder: "Search releases", className: "max-w-sm" },
});

export const Empty = meta.story();

export const Filled = meta.story({ args: { defaultValue: "docs/manual/block-tests.mdx" } });

export const Invalid = meta.story({ args: { defaultValue: "../etc", "aria-invalid": true } });

export const Disabled = meta.story({ args: { defaultValue: "Read only", disabled: true } });
