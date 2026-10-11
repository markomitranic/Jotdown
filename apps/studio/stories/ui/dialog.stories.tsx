import preview from "@/.storybook/preview";
import { Button } from "@jotdown/core/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@jotdown/core/components/ui/dialog";

const meta = preview.meta({
  title: "UI/Dialog",
  component: Dialog,
  render: () => (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename this page</DialogTitle>
          <DialogDescription>
            The address changes with the title, and the old one forwards to the new.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
});

export const Open = meta.story();
