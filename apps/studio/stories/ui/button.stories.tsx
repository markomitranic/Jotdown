import { ArrowRight, Plus } from "lucide-react";
import preview from "@/.storybook/preview";
import { Button } from "@jotdown/core/components/ui/button";

const meta = preview.meta({
  title: "UI/Button",
  component: Button,
  parameters: { layout: "padded" },
  args: { children: "Save changes" },
});

export const Default = meta.story();

export const Variants = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">
        Large <ArrowRight data-icon="inline-end" />
      </Button>
      <Button size="icon-xs" aria-label="Add">
        <Plus />
      </Button>
      <Button size="icon-sm" aria-label="Add">
        <Plus />
      </Button>
      <Button size="icon" aria-label="Add">
        <Plus />
      </Button>
      <Button size="icon-lg" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
});
