import preview from "@/.storybook/preview";
import { Textarea } from "@jotdown/core/components/ui/textarea";

const meta = preview.meta({
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "padded" },
  args: { placeholder: "Add a comment", className: "max-w-sm" },
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: { defaultValue: "Is this every category page, or only the ones on the old template?" },
});

export const Invalid = meta.story({ args: { defaultValue: "", "aria-invalid": true } });
