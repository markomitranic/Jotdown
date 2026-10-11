import { BookDashed } from "lucide-react";
import { StudioState } from "../StudioState";
import { SetUpButton } from "./SetUpButton";

/**
 * What a repository shows before anybody has set it up: that its default branch has no docs, and the way to set them up.
 *
 * The studio reads only the default branch, so docs added on another branch,
 * or never pushed, look exactly like none at all. That is said too.
 *
 * @example <NoDocsYet projectKey="you/site" branch="main" />
 */
export function NoDocsYet({ projectKey, branch }: { projectKey: string; branch: string }) {
  return (
    <StudioState
      icon={<BookDashed />}
      title={
        <>
          No docs on <code className="font-mono">{branch}</code> yet
        </>
      }
      description={
        <>
          {projectKey} has no <code>.jotdown/config.json</code> on its default branch, which is the one the studio
          reads. Docs on another branch show here once they are merged.
        </>
      }
    >
      <SetUpButton projectKey={projectKey} />
    </StudioState>
  );
}
