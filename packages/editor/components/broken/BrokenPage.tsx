import { DocsDescription, DocsTitle } from "@jotdown/core/components/docs/page";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { Button } from "@jotdown/core/components/ui/button";
import { FrontmatterForm } from "./FrontmatterForm";

type Props = {
  /** What the page is listed as while its own title cannot be read. */
  title: string;
  /** The page's file, `docs/guides/setup.mdx`. */
  path: string;
  /** What is wrong with its front matter. */
  problem: string;
  /** The file as it was rendered from, or null where nobody signed in may fix it. */
  text: string | null;
  /** The file on GitHub, or empty for a folder on this machine. */
  githubUrl: string;
};

/**
 * A page whose front matter cannot be read, said in place of the article, with the form that fixes it.
 *
 * @example <BrokenPage title="setup" path="docs/setup.mdx" problem="title: Invalid input" text={raw} githubUrl="https://github.com/…" />
 */
export function BrokenPage({ title, path, problem, text, githubUrl }: Props) {
  return (
    <>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>
        Sorry, this page cannot open because its front matter, the fields at the top of the file, is broken. Fix them
        below and it opens again.
      </DocsDescription>
      <ProblemText file={path} problem={problem} />
      {text !== null ? (
        <FrontmatterForm path={path} text={text} githubUrl={githubUrl} />
      ) : (
        githubUrl && (
          <Button variant="outline" size="lg" className="mt-8" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              <GitHubMark />
              Open in GitHub
            </a>
          </Button>
        )
      )}
    </>
  );
}

/**
 * A file's path and what is wrong with it, word for word as the parser said it.
 *
 * @example <ProblemText file="docs/setup.mdx" problem="title: Invalid input" />
 */
function ProblemText({ file, problem }: { file: string; problem: string }) {
  return (
    <div role="alert" className="border-destructive border-l-2 pl-4">
      <p className="font-mono text-[0.8125rem] text-foreground">{file}</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-destructive text-xs leading-relaxed">{problem}</pre>
    </div>
  );
}
