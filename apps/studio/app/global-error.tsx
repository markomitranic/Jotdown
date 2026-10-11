"use client";

import "@jotdown/core/css/global.css";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@jotdown/core/components/ui/empty";

type Props = { error: Error & { digest?: string }; retry: () => void };

/**
 * What the studio shows when its own frame failed to draw, standing in for the whole document.
 *
 * With no layout around it there is no sidebar to fall back on, so it offers
 * one way forward, trying again. Its digest is shown so it can be matched to
 * the server's logs.
 */
export default function GlobalError({ error, retry }: Props) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <title>The studio could not open</title>
        <Empty className="min-h-dvh">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle className="text-base">The studio could not open</EmptyTitle>
            <EmptyDescription>
              Something broke before the page could be drawn.
              {error.digest && <span className="mt-3 block font-mono text-xs">Error {error.digest}</span>}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button onClick={retry}>
              <RotateCw data-icon="inline-start" />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      </body>
    </html>
  );
}
