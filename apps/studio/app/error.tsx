"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { StudioState } from "@/components/studio/StudioState";

type Props = { error: Error & { digest?: string }; retry: () => void };

/**
 * What a page that threw while drawing shows, inside the project's own sidebar so the way out stays in reach.
 *
 * Try again fetches the page from the server afresh. The digest names the
 * failure in the server's logs, so a report can be matched to it.
 */
export default function PageError({ error, retry }: Props) {
  return (
    <StudioState
      icon={<TriangleAlert />}
      title="This page could not be opened"
      description={
        <>
          Something broke while drawing it. Try again, or pick another page from the sidebar.
          {error.digest && <span className="mt-3 block font-mono text-xs">Error {error.digest}</span>}
        </>
      }
    >
      <Button onClick={retry}>
        <RotateCw data-icon="inline-start" />
        Try again
      </Button>
    </StudioState>
  );
}
