import preview from "@/.storybook/preview";
import { Label } from "@jotdown/core/components/ui/label";
import { Switch } from "@jotdown/core/components/ui/switch";

const meta = preview.meta({
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "padded" },
  render: (args) => (
    <Label className="cursor-pointer font-normal">
      <Switch {...args} />
      llms.txt
    </Label>
  ),
});

export const Off = meta.story();

export const On = meta.story({ args: { defaultChecked: true } });

export const Disabled = meta.story({ args: { disabled: true } });
