"use client";

import { ArrowRight, FilePlus2 } from "lucide-react";
import { DOCS_ROOT } from "@jotdown/core/lib/paths";
import { Button } from "@jotdown/core/components/ui/button";
import { useIdentity } from "@jotdown/editor/client/identity";
import { useStructure } from "@jotdown/editor/structure/useStructure";
import type { StructureOp } from "@jotdown/editor/types";
import { StudioState } from "./StudioState";

const FIRST_PAGE = {
  kind: "create",
  path: `${DOCS_ROOT}/index.mdx`,
  title: "Home",
  description: null,
  icon: "FileText",
} satisfies StructureOp;

/**
 * What a set-up project shows before it has a single page: that it is empty, and the way to write the first one.
 *
 * The page is committed the way the sidebar commits one, so the studio draws
 * it the moment the commit lands.
 *
 * @example <NoPagesYet projectKey="you/site" />
 */
export function NoPagesYet({ projectKey }: { projectKey: string }) {
  const structure = useStructure();
  const { identity } = useIdentity();
  const writing = structure?.phase.name === "saving";

  return (
    <StudioState
      icon={<FilePlus2 />}
      title="No pages yet"
      description={
        <>
          {projectKey} is set up, but its <code>{DOCS_ROOT}/</code> folder has no pages. Start with a home page, and add
          the rest from the sidebar.
        </>
      }
    >
      {structure && identity && (
        <Button onClick={() => structure.commitNow(FIRST_PAGE, identity)} disabled={writing}>
          {writing ? "Writing the first page…" : "Write the first page"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      )}
    </StudioState>
  );
}
