import { FileQuestion } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { StudioState } from "@/components/studio/StudioState";
import { currentProject } from "@/server/projects/context";

/** Rendered inside the docs shell, so the sidebar stays on the way back to the project's first page. */
export default async function NotFound() {
  const project = await currentProject().catch(() => null);

  return (
    <StudioState
      icon={<FileQuestion />}
      title="Page not found"
      description="Nothing lives at this address. It was deleted, or never existed."
    >
      <Button variant="outline" asChild>
        <a href={project?.base || "/"}>Back to the start</a>
      </Button>
    </StudioState>
  );
}
