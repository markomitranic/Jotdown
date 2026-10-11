import preview from "@/.storybook/preview";
import { Avatar, AvatarFallback, AvatarImage } from "@jotdown/core/components/ui/avatar";

const meta = preview.meta({
  title: "UI/Avatar",
  component: Avatar,
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args}>
        <AvatarImage src="https://github.com/octocat.png?size=64" alt="" />
        <AvatarFallback>OC</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback className="font-medium">AB</AvatarFallback>
      </Avatar>
    </div>
  ),
});

export const Default = meta.story();

export const Small = meta.story({ args: { size: "sm" } });

export const ExtraSmall = meta.story({ args: { size: "xs" } });
