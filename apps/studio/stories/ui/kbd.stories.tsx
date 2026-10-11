import preview from "@/.storybook/preview";
import { Kbd, KbdGroup } from "@jotdown/core/components/ui/kbd";

const meta = preview.meta({
  title: "UI/Kbd",
  component: Kbd,
  parameters: { layout: "padded" },
});

export const Key = meta.story({ args: { children: "K" } });

export const Chord = meta.story({
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>⌥</Kbd>
      <Kbd>M</Kbd>
    </KbdGroup>
  ),
});
