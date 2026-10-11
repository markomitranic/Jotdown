import preview from "@/.storybook/preview";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@jotdown/core/components/ui/sheet";

const meta = preview.meta({
  title: "UI/Sheet",
  component: Sheet,
  render: () => (
    <Sheet open>
      <SheetContent>
        <div className="flex flex-col gap-1 p-6">
          <SheetTitle>Page history</SheetTitle>
          <SheetDescription>Every commit that touched this page, newest first.</SheetDescription>
        </div>
      </SheetContent>
    </Sheet>
  ),
});

export const Open = meta.story();
