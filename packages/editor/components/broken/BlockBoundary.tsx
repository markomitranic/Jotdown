"use client";

import { Component, type ReactNode } from "react";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { useDocTarget } from "@jotdown/editor/client/api";

type Props = { name: string; range?: string; children: ReactNode };

/**
 * Keeps one block that throws from taking its page with it, drawing what went wrong where the block stood.
 *
 * @example <BlockBoundary name="Chart" range="12:1-20:3"><Chart {...props} /></BlockBoundary>
 */
export class BlockBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <BlockProblem name={this.props.name} line={this.props.range?.split(":")[0]} error={error} />;
  }
}

/** A block that could not be drawn: which one, on which line of its file, and the error it threw. */
function BlockProblem({ name, line, error }: { name: string; line?: string; error: Error }) {
  const { path, githubUrl } = useDocTarget();

  return (
    <div role="alert" className="not-prose my-4 border-destructive border-l-2 pl-4 text-sm">
      <p className="text-foreground">
        The <code>{name}</code> block could not be drawn.{" "}
        <span className="font-mono text-[0.8125rem] text-muted-foreground">
          {path}
          {line && `:${line}`}
        </span>
      </p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-destructive text-xs leading-relaxed">{error.message}</pre>
      {githubUrl && (
        <a
          href={line ? `${githubUrl}#L${line}` : githubUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground underline underline-offset-3 hover:text-foreground"
        >
          <GitHubMark />
          Open in GitHub
        </a>
      )}
    </div>
  );
}
