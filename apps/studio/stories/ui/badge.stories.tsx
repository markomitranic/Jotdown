import preview from "@/.storybook/preview";
import { Badge } from "@jotdown/core/components/ui/badge";

const meta = preview.meta({
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>New</Badge>
      <Badge variant="secondary">Adds a section</Badge>
      <Badge variant="outline">Kept as it is</Badge>
      <Badge variant="destructive">Refused</Badge>
    </div>
  ),
});

export const Default = meta.story();
