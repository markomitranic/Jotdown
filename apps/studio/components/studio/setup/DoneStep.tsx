"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CircleCheck,
  Copy,
  FolderInput,
  Globe,
  LayoutPanelLeft,
} from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@jotdown/core/components/ui/item";
import { useCopyButton } from "@jotdown/core/lib/use-copy-button";
import { OLD_FOLDER, type Inspection, type SetupAnswers, type SetupDone, type SetupTarget } from "@/lib/setup";
import { QUESTION } from "./WizardFrame";
import { PUBLISHING_GUIDES } from "./Steps";

type Props = {
  done: SetupDone;
  target: SetupTarget | null;
  inspection: Inspection | null;
  publishing: SetupAnswers["publishing"];
  moved: string | null;
  onOpenProject: () => void;
};

const MANUAL = "/markomitranic/Jotdown";

/** What each host is called where the next steps name it. */
const HOSTS = { vercel: "Vercel", "github-pages": "GitHub Pages" };

/**
 * The end of the wizard: what was written, and the next steps as links.
 *
 * `moved` is the content folder whose old files went into `_old/`, which offers a prompt to port them, or null.
 *
 * @example <DoneStep done={done} target={target} inspection={inspection} publishing="vercel" moved={null} onOpenProject={open} />
 */
export function DoneStep({ done, target, inspection, publishing, moved, onOpenProject }: Props) {
  const onGitHub = target?.kind === "github";
  const branch = inspection?.branch ?? "the default branch";
  const written = done.files.filter((file) => file.change !== "kept").length;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <h2 className={QUESTION}>Your docs are ready.</h2>
        <Item variant="muted" size="sm" className="bg-primary/8">
          <ItemMedia variant="icon">
            <CircleCheck className="text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{done.title}</ItemTitle>
            <ItemDescription>
              {onGitHub
                ? `Committed to ${branch} of ${done.key}, ${written} files.`
                : `Written into the folder, ${written} files. Commit and push when you have read them.`}
            </ItemDescription>
          </ItemContent>
        </Item>
      </div>

      <section aria-labelledby="setup-next" className="flex flex-col gap-3">
        <h3 id="setup-next" className="font-medium text-base">
          Next steps
        </h3>
        <ul className="flex flex-col gap-2">
          <Next
            onClick={onOpenProject}
            icon={<LayoutPanelLeft />}
            title="Open your docs project in the studio"
            detail="Read and edit every page where it stands"
          />
          {moved !== null && <PortPrompt folder={moved} branch={onGitHub ? branch : null} />}
          <Next
            href={`${MANUAL}/studio/local-studio#ask-your-agent-for-a-first-page`}
            icon={<Bot />}
            title="Ask your agent for a first page"
            detail="A prompt that writes one real page about your code"
          />
          {publishing !== "none" && (
            <Next
              href={PUBLISHING_GUIDES[publishing]}
              icon={<Globe />}
              title={`Finish setting up a publication in ${HOSTS[publishing]}`}
              detail="The token, the project and who can read it"
            />
          )}
        </ul>
      </section>
    </div>
  );
}

/**
 * The next step that copies a prompt for porting the old docs out of `_old/`, and says it worked.
 *
 * @example <PortPrompt folder="apps/web" branch="main" />
 */
function PortPrompt({ folder, branch }: { folder: string; branch: string | null }) {
  const [copied, copy] = useCopyButton(() => navigator.clipboard.writeText(portPrompt(folder, branch)));

  return (
    <Next
      onClick={copy}
      icon={<FolderInput />}
      title={`Ask your agent to port ${OLD_FOLDER}/ into your docs`}
      detail={
        copied ? "Copied. Paste it into Claude Code, Codex or Cursor" : "Copies a prompt that moves every old page"
      }
      trailing={copied ? <Check className="text-primary" /> : <Copy />}
    />
  );
}

/**
 * A prompt that has an agent port the old docs out of `_old/` into the new docs, page for page.
 *
 * A branch means the setup committed on GitHub and the agent pulls it first; without one the
 * setup's files are still uncommitted on disk, and are committed on their own first.
 *
 * @example portPrompt("", "main"); // "Read the authoring, blocks and editorial-illustration skills…"
 */
function portPrompt(folder: string, branch: string | null) {
  const root = folder ? `${folder}/` : "";
  const old = `${root}${OLD_FOLDER}/`;
  const docs = `${root}docs/`;

  return [
    "Read the authoring, blocks and editorial-illustration skills in .agents/skills/ first.",
    "",
    `The Jotdown setup moved this repository's old docs into ${old}. Port them into the new docs in ${docs}, one step at a time:`,
    "",
    branch
      ? `1. Check out ${branch} and pull, so the setup's commit and the skills are on your disk.`
      : "1. Commit the files the setup wrote, on their own, so the port is a change of its own.",
    `2. Inspect ${old}: every file, how it is organised, how the pages link to each other, and the images and attachments they use.`,
    `3. Plan the new structure per the authoring skill: the roots, the sidebar sections in each, and the folder every page lands in. Show me the plan as a tree that maps each old file to its new path, and wait for my approval.`,
    `4. Once I approve, move every file with git mv and convert it into the new format: front matter, MDX syntax, links between pages and image paths. Do not change what the pages say: no rewording, summarising, merging or dropping content. Run \`jotdown check\` and fix every error it reports.`,
    "5. Pick the one page readers will land on most, and have a subagent paint its editorial illustration per the editorial-illustration skill.",
    branch
      ? `6. Commit, and push to ${branch}. If you cannot push to it, open a pull request instead.`
      : "6. Commit, then push or open a pull request, whichever this repository expects.",
    "7. Suggest 5 or 6 more pages that would gain the most from an editorial illustration, one line each on why, and ask me which ones to paint.",
  ].join("\n");
}

/** A next step: a guide opened in a new tab, or an action taken here. */
function Next({
  href,
  onClick,
  icon,
  title,
  detail,
  trailing,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  title: string;
  detail: string;
  trailing?: ReactNode;
}) {
  const row = (
    <>
      <ItemMedia variant="icon" className="text-muted-foreground">
        {icon}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription className="line-clamp-1 text-xs">{detail}</ItemDescription>
      </ItemContent>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground [&_svg]:size-4">
        {trailing ?? (href ? <ArrowUpRight /> : <ArrowRight />)}
      </span>
    </>
  );

  return (
    <li>
      <Item asChild variant="outline" size="sm" className="text-start hover:bg-foreground/4">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {row}
          </a>
        ) : (
          <button type="button" onClick={onClick}>
            {row}
          </button>
        )}
      </Item>
    </li>
  );
}
