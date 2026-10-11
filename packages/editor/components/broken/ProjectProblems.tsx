"use client";

import { useState } from "react";
import Link from "next/link";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { Button } from "@jotdown/core/components/ui/button";
import { Banner } from "@jotdown/editor/client/Banner";
import { FixJsonFile, fixableInPlace } from "./FixJsonFile";

/** One file of the project that could not be read, with the page it opens as when it is one. */
export type ProjectProblem = { file: string; problem: string; url: string | null };

/**
 * The strip above every page that names each file of the project that could not be read, until it is fixed.
 *
 * A broken page links to itself, where it can be fixed; a `meta.json` or the
 * move record is fixed right here; anything else opens in GitHub. The page on
 * screen is left out, since it says so itself.
 *
 * @example <ProjectProblems problems={problems} fileUrl="https://github.com/you/notes/blob/main/" current="docs/setup.mdx" />
 */
export function ProjectProblems({
  problems,
  fileUrl,
  current,
}: {
  problems: ProjectProblem[];
  fileUrl: string;
  current?: string;
}) {
  const shown = problems.filter((problem) => problem.file !== current);
  if (!shown.length) return null;

  return (
    <Banner tone="error" alert>
      <p className="font-medium text-foreground">
        {shown.length === 1
          ? "A file in this project could not be read."
          : `${shown.length} files in this project could not be read.`}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((problem) => (
          <ProblemRow key={problem.file} problem={problem} fileUrl={fileUrl} />
        ))}
      </ul>
    </Banner>
  );
}

/** One unreadable file: its path, what is wrong with it, and the way to fix it. */
function ProblemRow({ problem: { file, problem, url }, fileUrl }: { problem: ProjectProblem; fileUrl: string }) {
  const [fixing, setFixing] = useState(false);

  return (
    <li className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.8125rem] text-foreground">{file}</p>
        <p className="mt-0.5 whitespace-pre-line text-pretty font-mono text-muted-foreground text-xs">{problem}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {url && (
          <Button variant="outline" size="sm" asChild>
            <Link href={url}>Fix</Link>
          </Button>
        )}
        {fixableInPlace(file) && (
          <>
            <Button variant="outline" size="sm" onClick={() => setFixing(true)}>
              Fix
            </Button>
            <FixJsonFile file={file} open={fixing} onOpenChange={setFixing} />
          </>
        )}
        {fileUrl && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={fileUrl + file} target="_blank" rel="noreferrer" aria-label={`Open ${file} in GitHub`}>
              <GitHubMark />
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
