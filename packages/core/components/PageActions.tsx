"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "fumadocs-core/framework";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";
import { Check, ChevronDown, Copy, ExternalLink, Share2, Text } from "lucide-react";
import { AnthropicMark, CursorMark, GitHubMark, OpenAIMark } from "@jotdown/core/components/brand-icons";
import { Button } from "@jotdown/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";

type Props = {
  /** Where this page is served as its own markdown source. */
  markdownUrl: string;
  /** The page's `.mdx` file on GitHub. */
  githubUrl: string;
  /** Opens the page's share controls, where there are any; otherwise Share copies the address. */
  onShare?: () => void;
  /** Rows of the app's own, listed after View as Markdown. */
  children?: ReactNode;
  /** Handed to the menu for the moment it closes, so a row that opens something can keep the focus. */
  onCloseAutoFocus?: (event: Event) => void;
};

/**
 * The split button in the article's top right corner: share the page, or open
 * the chevron for every other thing you can do with it.
 *
 * There is no pencil, because there is nothing to open: every block on the page
 * is already editable and a click puts a caret in one. What stays here are the
 * reading tools, copying the page, handing it to an assistant and opening it in
 * GitHub. An app that edits pages adds its own rows as children.
 *
 * @example <PageActions markdownUrl="/markdown/architecture.md" githubUrl="https://…" />
 */
export function PageActions({ markdownUrl, githubUrl, onShare, children, onCloseAutoFocus }: Props) {
  const [copied, copy] = useCopyMarkdown(markdownUrl);
  const [linked, copyAddress] = useCopyButton(() => navigator.clipboard.writeText(window.location.href));

  return (
    <div className="not-prose flex items-center">
      <Button variant="outline" size="sm" className="rounded-r-none" onClick={onShare ?? copyAddress}>
        {linked ? <Check /> : <Share2 />}
        Share
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" className="-ml-px rounded-l-none" aria-label="More for this page">
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={onCloseAutoFocus}>
          <DropdownMenuItem onClick={copy} onSelect={(event) => event.preventDefault()}>
            {copied ? <Check /> : <Copy />}
            Copy markdown
          </DropdownMenuItem>
          <Elsewhere href={markdownUrl} icon={<Text />}>
            View as Markdown
          </Elsewhere>
          {children}
          {githubUrl && (
            <Elsewhere href={githubUrl} icon={<GitHubMark />}>
              Open in GitHub
            </Elsewhere>
          )}
          <DropdownMenuSeparator />
          <AssistantLinks />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Puts the page's markdown source on the clipboard, and says it worked.
 *
 * The fetch is handed to `navigator.clipboard.write` as a promise so the write
 * counts as part of the click, which is what Safari requires of a clipboard
 * write that has to wait for a network round trip.
 *
 * @example const [copied, copy] = useCopyMarkdown("/llms.mdx/architecture");
 */
function useCopyMarkdown(markdownUrl: string) {
  return useCopyButton(async () => {
    const text = fetch(markdownUrl).then((res) => res.text());
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]);
  });
}

/**
 * The rows that hand this page to an assistant, each carrying the page's own URL.
 *
 * The origin arrives from an effect rather than from `window` during render, so
 * the server's HTML and the browser's first pass agree.
 */
function AssistantLinks() {
  const pathname = usePathname();
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const question = `Read ${origin}${pathname}, I want to ask questions about it.`;

  return (
    <>
      <Elsewhere href={`https://claude.ai/new?${new URLSearchParams({ q: question })}`} icon={<AnthropicMark />}>
        Open in Claude
      </Elsewhere>
      <Elsewhere
        href={`https://chatgpt.com/?${new URLSearchParams({ prompt: question, hints: "search" })}`}
        icon={<OpenAIMark />}
      >
        Open in ChatGPT
      </Elsewhere>
      <Elsewhere
        href={`https://cursor.com/link/prompt?${new URLSearchParams({ text: question })}`}
        icon={<CursorMark />}
      >
        Open in Cursor
      </Elsewhere>
    </>
  );
}

/** A menu row that leaves the site, marked as such by the arrow on its right. */
function Elsewhere({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenuItem asChild>
      <a href={href} target="_blank" rel="noreferrer noopener">
        {icon}
        {children}
        <ExternalLink className="ms-auto size-3.5 text-muted-foreground" />
      </a>
    </DropdownMenuItem>
  );
}
