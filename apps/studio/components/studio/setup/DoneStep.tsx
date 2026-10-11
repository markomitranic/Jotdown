"use client";

import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Bot, CircleCheck, Globe, LayoutPanelLeft } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@jotdown/core/components/ui/item";
import type { Inspection, SetupAnswers, SetupDone, SetupTarget } from "@/lib/setup";
import { QUESTION } from "./WizardFrame";
import { PUBLISHING_GUIDES } from "./Steps";

type Props = {
  done: SetupDone;
  target: SetupTarget | null;
  inspection: Inspection | null;
  publishing: SetupAnswers["publishing"];
  onOpenProject: () => void;
};

const MANUAL = "/markomitranic/Jotdown";

/** What each host is called where the next steps name it. */
const HOSTS = { vercel: "Vercel", "github-pages": "GitHub Pages" };

/**
 * The end of the wizard: what was written, and the next steps as links.
 *
 * @example <DoneStep done={done} target={target} inspection={inspection} publishing="vercel" onOpenProject={open} />
 */
export function DoneStep({ done, target, inspection, publishing, onOpenProject }: Props) {
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

/** A next step: a guide opened in a new tab, or the project opened here. */
function Next({
  href,
  onClick,
  icon,
  title,
  detail,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  title: string;
  detail: string;
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
      {href ? (
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
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
