import { useState } from "react";
import { Button } from "@jotdown/core/components/ui/button";
import { confirmInPage } from "@jotdown/core/components/confirm";
import preview from "@/.storybook/preview";

/**
 * The page's own yes or no question, asked where `window.confirm` would be, since the macOS app's webview answers that with a silent no.
 */
const meta = preview.meta({
  title: "UI/Confirm",
  render: function Render() {
    const [answer, setAnswer] = useState<string | null>(null);

    async function ask() {
      const yes = await confirmInPage({
        title: "Discard your changes?",
        description: "The page reloads as the file has it, and everything you changed on it is gone.",
        confirm: "Discard changes",
      });
      setAnswer(yes ? "Discarded" : "Kept");
    }

    return (
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={ask}>
          Dismiss changes
        </Button>
        {answer && <span className="text-muted-foreground text-sm">{answer}</span>}
      </div>
    );
  },
});

export const Default = meta.story();
