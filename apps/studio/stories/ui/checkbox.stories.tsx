import preview from "@/.storybook/preview";
import { Checkbox } from "@jotdown/core/components/ui/checkbox";
import { Label } from "@jotdown/core/components/ui/label";

const meta = preview.meta({
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "padded" },
  render: (args) => (
    <Label className="cursor-pointer font-normal">
      <Checkbox {...args} />
      Move them into _old/ first
    </Label>
  ),
});

export const Unchecked = meta.story();

export const Checked = meta.story({ args: { defaultChecked: true } });

export const Disabled = meta.story({ args: { disabled: true } });
