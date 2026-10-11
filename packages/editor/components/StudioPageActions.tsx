"use client";

import { useRef, type ComponentProps } from "react";
import { useMutation } from "@tanstack/react-query";
import { SquarePen } from "lucide-react";
import { PageActions } from "@jotdown/core/components/PageActions";
import { DropdownMenuItem } from "@jotdown/core/components/ui/dropdown-menu";
import { useLiveEditConfig } from "@jotdown/editor/client/api";
import { useInplace } from "@jotdown/editor/inplace/context";
import { currentMarkdown, MarkdownStage } from "@jotdown/editor/inplace/MarkdownStage";

type Props = Pick<ComponentProps<typeof PageActions>, "markdownUrl" | "githubUrl" | "onShare">;

/**
 * The page menu with the one way past the blocks an editable page offers: its markdown by hand.
 *
 * @example <StudioPageActions markdownUrl="/you/notes/llms.mdx/setup" githubUrl="https://…" onShare={() => drawer.show("share")} />
 */
export function StudioPageActions(props: Props) {
  const markdown = useMarkdownEditing();

  return (
    <>
      <PageActions {...props} onCloseAutoFocus={markdown.keepFocus}>
        {markdown.offered && (
          <DropdownMenuItem onSelect={markdown.open}>
            <SquarePen />
            Edit as Markdown
          </DropdownMenuItem>
        )}
      </PageActions>
      {markdown.initial !== undefined && <MarkdownStage initial={markdown.initial} onClose={markdown.close} />}
    </>
  );
}

/**
 * Whether this page can be edited as markdown, and the text the editor opens with.
 *
 * Closing a menu hands focus back to its trigger. `keepFocus` refuses that for
 * the one close that opens the editor, whose textarea takes the focus itself.
 *
 * @example const markdown = useMarkdownEditing(); markdown.open();
 */
function useMarkdownEditing() {
  const page = useInplace();
  const { editable } = useLiveEditConfig();
  const opening = useMutation({ mutationFn: currentMarkdown });
  const focusing = useRef(false);

  function open() {
    if (!page) return;
    focusing.current = true;
    opening.mutate(page);
  }

  function keepFocus(event: Event) {
    if (!focusing.current) return;
    focusing.current = false;
    event.preventDefault();
  }

  return {
    offered: editable && page !== null,
    initial: opening.data,
    open,
    close: opening.reset,
    keepFocus,
  };
}
