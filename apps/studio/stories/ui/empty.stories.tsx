import { MessageSquareText } from "lucide-react";
import preview from "@/.storybook/preview";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@jotdown/core/components/ui/empty";

const meta = preview.meta({
  title: "UI/Empty",
  component: Empty,
  parameters: { layout: "padded" },
  render: () => (
    <Empty className="max-w-sm">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareText />
        </EmptyMedia>
        <EmptyTitle>No open comments</EmptyTitle>
        <EmptyDescription>Select words on the page to start a thread.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
});

export const Default = meta.story();
