"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "cn";
import {
  Archive,
  Bot,
  CircleAlert,
  Clock,
  FolderTree,
  House,
  BookOpen,
  Library,
  Link2,
  Sparkles,
  Triangle,
} from "lucide-react";
import { Checkbox } from "@jotdown/core/components/ui/checkbox";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@jotdown/core/components/ui/item";
import { Label } from "@jotdown/core/components/ui/label";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@jotdown/core/components/ui/field";
import { Input } from "@jotdown/core/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@jotdown/core/components/ui/input-group";
import {
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireItem,
} from "@jotdown/core/components/ui/questionnaire";
import { OLD_FOLDER, setupAnswersSchema, STARTER_PAGES, type ContentState, type SetupAnswers } from "@/lib/setup";
import { ChoiceName, Path, Question } from "./Choices";
import type { Draft } from "./SetupWizard";

/**
 * The wizard's plainer questions: the folder, the name, the pages, the agents and the publishing host, each a questionnaire item.
 *
 * Choices answer to their letter, A, B, C, as the questionnaire numbers them.
 */

const ROOT = "root";

/** The manual's guide to each publishing host, which walks its follow-up steps. */
export const PUBLISHING_GUIDES = {
  vercel: "/markomitranic/Jotdown/publication/vercel",
  "github-pages": "/markomitranic/Jotdown/publication/github-pages",
};

type FolderProps = {
  content: string;
  /** Whether "Another folder" is the answer, even before a folder is typed into it. */
  elsewhere: boolean;
  onContent: (content: string, elsewhere: boolean) => void;
  holding: UseQueryResult<ContentState>;
  moveOld: boolean;
  onMoveOld: (moveOld: boolean) => void;
};

/**
 * Where `docs/` goes: the repository root, which is the answer unless another folder is typed in, and what that folder already holds.
 *
 * The folder is checked as it is chosen. Anything in its way can be moved into
 * `_old/`, and has to be before the step is answered.
 *
 * @example <FolderStep content="" elsewhere={false} onContent={setContent} holding={useQuery(contentQuery)} moveOld={false} onMoveOld={setMoveOld} />
 */
export function FolderStep({ content, elsewhere, onContent, holding, moveOld, onMoveOld }: FolderProps) {
  const problem =
    elsewhere && content ? setupAnswersSchema.shape.content.safeParse(content).error?.issues[0]?.message : undefined;

  return (
    <QuestionnaireItem name="folder">
      <Question
        title="Which folder holds the docs?"
        description={
          <>
            <Path>.jotdown/config.json</Path> sits at the repository root and points at the folder, but any sub-folder
            can carry your content, markdown and uploads.
          </>
        }
      />
      <QuestionnaireChoices>
        <QuestionnaireChoice value={ROOT} checked={!elsewhere} onChange={() => onContent("", false)}>
          <ChoiceName icon={<House />}>The repository root</ChoiceName>
          <QuestionnaireChoiceDescription>
            <Path>docs/</Path> in the repository root, uploads included.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice value="elsewhere" checked={elsewhere} onChange={() => onContent(content, true)}>
          <ChoiceName icon={<FolderTree />}>Another folder</ChoiceName>
          <QuestionnaireChoiceDescription>
            Another sub-folder that will contain <Path>docs/</Path>.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
      </QuestionnaireChoices>
      {elsewhere && (
        <Input
          autoFocus
          aria-label="Folder"
          aria-invalid={Boolean(problem)}
          placeholder="handbook"
          spellCheck={false}
          value={content}
          onChange={(event) => onContent(event.target.value.replace(/^\/+|\/+$/g, ""), true)}
          className="h-10 font-mono text-[0.8125rem]"
        />
      )}
      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : (
        <Holding folder={content} holding={holding} moveOld={moveOld} onMoveOld={onMoveOld} />
      )}
    </QuestionnaireItem>
  );
}

/**
 * What is in the chosen folder's way, and the offer to move it into `_old/` first.
 */
function Holding({
  folder,
  holding,
  moveOld,
  onMoveOld,
}: {
  folder: string;
  holding: UseQueryResult<ContentState>;
  moveOld: boolean;
  onMoveOld: (moveOld: boolean) => void;
}) {
  const where = folder || "the repository root";
  const old = `${folder ? `${folder}/` : ""}${OLD_FOLDER}/`;

  const state = holding.data;
  if (holding.error && !state)
    return (
      <p role="alert" className="text-destructive text-sm">
        {holding.error.message}
      </p>
    );
  if (!state)
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Checking what {where} holds…
      </p>
    );
  if (state.kind === "clear") return null;

  const more = state.count - state.entries.length;
  return (
    <Item variant="muted" size="sm" className={cn(moveOld ? "bg-primary/8" : "bg-destructive/8")} aria-live="polite">
      <ItemMedia variant="icon">
        {moveOld ? <Archive className="text-primary" /> : <CircleAlert className="text-destructive" />}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="font-mono text-[0.8125rem]">{folder || "docs/"}</span>{" "}
          {folder ? "already holds files" : "already exists"}
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {folder
            ? `${state.entries.join(", ")}${more > 0 ? ` and ${more} more` : ""}. Docs cannot be set up on top of them.`
            : "Docs cannot be set up on top of it."}
        </ItemDescription>
        <Label className="mt-2 cursor-pointer items-start gap-2.5 font-normal text-foreground leading-snug">
          <Checkbox checked={moveOld} onCheckedChange={(checked) => onMoveOld(checked === true)} className="mt-px" />
          <span>
            Move {folder ? "them" : "it"} into <Path>{old}</Path> first, and ask your agent to port what is worth
            keeping later.
          </span>
        </Label>
      </ItemContent>
    </Item>
  );
}

/**
 * What is wrong with the name step's answers, per field, or nothing.
 *
 * @example nameProblems({ ...draft, title: "" }); // { title: "Give the docs a title.", url: undefined }
 */
export function nameProblems(draft: Pick<Draft, "title" | "url">) {
  const { shape } = setupAnswersSchema;
  return {
    title: shape.title.safeParse(draft.title).error?.issues[0]?.message,
    url: shape.url.safeParse(draft.url).error?.issues[0]?.message,
  };
}

/**
 * The docs' title and one line about them, and where readers find them once published.
 *
 * A field says what is wrong with it once it has been left, never while it is being typed.
 *
 * @example <NameStep draft={draft} onChange={change} />
 */
export function NameStep({ draft, onChange }: { draft: Draft; onChange: (next: Partial<Draft>) => void }) {
  const [left, setLeft] = useState({ title: false, url: false });
  const problems = nameProblems(draft);
  const titleWrong = left.title && Boolean(problems.title);
  const addressWrong = left.url && Boolean(problems.url);

  return (
    <QuestionnaireItem name="name">
      <Question
        title="What are the docs called?"
        description="Filled in from the repository. Both show in the sidebar, in search and on the home page."
      />
      <FieldGroup className="gap-5">
        <Field data-invalid={titleWrong}>
          <FieldLabel htmlFor="setup-title">Title</FieldLabel>
          <Input
            id="setup-title"
            className="h-10"
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            onBlur={() => setLeft({ ...left, title: true })}
            aria-invalid={titleWrong}
          />
          <FieldError>{titleWrong && problems.title}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="setup-description">Description</FieldLabel>
          <Input
            id="setup-description"
            className="h-10"
            value={draft.description}
            placeholder="How checkout works, end to end"
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <FieldDescription>One sentence, shown under the title.</FieldDescription>
        </Field>
        <Field data-invalid={addressWrong}>
          <FieldLabel htmlFor="setup-public-url">
            Public address
            <span className="font-normal text-muted-foreground">Optional</span>
          </FieldLabel>
          <InputGroup className="h-10">
            <InputGroupAddon>
              <Link2 />
            </InputGroupAddon>
            <InputGroupInput
              id="setup-public-url"
              type="url"
              value={draft.url}
              placeholder="https://notes.example.com"
              onChange={(event) => onChange({ url: event.target.value.trim() })}
              onBlur={() => setLeft({ ...left, url: true })}
              aria-invalid={addressWrong}
            />
          </InputGroup>
          <FieldError>{addressWrong && problems.url}</FieldError>
          <FieldDescription>Used for generating share links for the publication.</FieldDescription>
        </Field>
      </FieldGroup>
    </QuestionnaireItem>
  );
}

/**
 * A home page alone, or the starter set of sections beside it.
 *
 * @example <PagesStep pages="starter" content="" onPages={setPages} />
 */
export function PagesStep({
  pages,
  content,
  onPages,
}: {
  pages: SetupAnswers["pages"];
  content: string;
  onPages: (pages: SetupAnswers["pages"]) => void;
}) {
  const docs = content ? `${content}/docs` : "docs";

  return (
    <QuestionnaireItem name="pages">
      <Question
        title="What should they start with?"
        description="Starter pages are short placeholders your agent replaces with what the code says."
      />
      <QuestionnaireChoices>
        <QuestionnaireChoice value="starter" checked={pages === "starter"} onChange={() => onPages("starter")}>
          <ChoiceName icon={<Library />}>A starter set</ChoiceName>
          <QuestionnaireChoiceDescription>
            Getting started, Architecture and Decision records, with a first record.
          </QuestionnaireChoiceDescription>
          <span className="mt-1.5 flex flex-col gap-0.5 font-mono text-muted-foreground text-xs">
            <span>{docs}/index.mdx</span>
            {STARTER_PAGES.map((page) => (
              <span key={page.path}>
                {docs}/{page.path}
              </span>
            ))}
          </span>
        </QuestionnaireChoice>
        <QuestionnaireChoice value="home" checked={pages === "home"} onChange={() => onPages("home")}>
          <ChoiceName icon={<House />}>Just a home page</ChoiceName>
          <QuestionnaireChoiceDescription>
            <Path>{docs}/index.mdx</Path>, for you or your agent to build on.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

type AgentsProps = {
  skills: boolean;
  agentNote: boolean;
  agentFile: "AGENTS.md" | "CLAUDE.md" | null;
  onChange: (next: { skills?: boolean; agentNote?: boolean }) => void;
};

/**
 * Whether the docs skills are installed, and whether the repository's agent instructions point at the docs. Either, both or neither.
 *
 * @example <AgentsStep skills agentNote agentFile="AGENTS.md" onChange={change} />
 */
export function AgentsStep({ skills, agentNote, agentFile, onChange }: AgentsProps) {
  return (
    <QuestionnaireItem name="agents" multiple>
      <Question
        title="Let agents know about the docs?"
        description="Set up the repo for easy use with Claude, Codex and OpenCode."
      />
      <QuestionnaireChoices>
        <QuestionnaireChoice
          value="skills"
          checked={skills}
          onChange={(event) => onChange({ skills: event.target.checked })}
        >
          <ChoiceName icon={<Sparkles />}>Install skills</ChoiceName>
          <QuestionnaireChoiceDescription>
            Teaches agents how to write, draw, diagram and port content. Installed into <Path>./.agents</Path> and
            symlinked into <Path>./.claude</Path>.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice
          value="note"
          checked={agentNote}
          onChange={(event) => onChange({ agentNote: event.target.checked })}
        >
          <ChoiceName icon={<Bot />}>Tell agents where the docs are</ChoiceName>
          <QuestionnaireChoiceDescription>
            {agentFile === "CLAUDE.md" ? (
              <>
                Update <Path>CLAUDE.md</Path> with a short explanation, so that they can search, read, review and
                maintain the docs.
              </>
            ) : agentFile ? (
              <>
                Update <Path>AGENTS.md</Path> with a short explanation, so that they can search, read, review and
                maintain the docs.
              </>
            ) : (
              <>
                Create <Path>AGENTS.md</Path> with a short explanation, so that they can search, read, review and
                maintain the docs, and <Path>CLAUDE.md</Path> importing it.
              </>
            )}
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

/**
 * Which host's files to prepare for a publication, if any, in `.jotdown/` beside the config. Nothing is deployed.
 *
 * @example <PublishingStep publishing="none" onPublishing={setPublishing} />
 */
export function PublishingStep({
  publishing,
  onPublishing,
}: {
  publishing: SetupAnswers["publishing"];
  onPublishing: (publishing: SetupAnswers["publishing"]) => void;
}) {
  return (
    <QuestionnaireItem name="publishing">
      <Question
        title="Publish it as a site?"
        description="By default the docs only open in the studio. A project can also be a read-only site for readers."
      />
      <QuestionnaireChoices>
        <QuestionnaireChoice value="none" checked={publishing === "none"} onChange={() => onPublishing("none")}>
          <ChoiceName icon={<Clock />}>Not yet</ChoiceName>
          <QuestionnaireChoiceDescription>Publishing can easily be added later.</QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice value="vercel" checked={publishing === "vercel"} onChange={() => onPublishing("vercel")}>
          <ChoiceName icon={<Triangle />}>Vercel</ChoiceName>
          <QuestionnaireChoiceDescription>
            Sets up <Path>.jotdown/vercel.json</Path> for easy deployment.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
        <QuestionnaireChoice
          value="github-pages"
          checked={publishing === "github-pages"}
          onChange={() => onPublishing("github-pages")}
        >
          <ChoiceName icon={<GitHubMark />}>GitHub Pages</ChoiceName>
          <QuestionnaireChoiceDescription>
            Adds <Path>.github/workflows/jotdown.yml</Path>, which publishes the site on every push.
          </QuestionnaireChoiceDescription>
        </QuestionnaireChoice>
      </QuestionnaireChoices>
      {publishing !== "none" && (
        <p className="flex items-start gap-2 text-muted-foreground text-sm">
          <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <a
            href={PUBLISHING_GUIDES[publishing]}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-3 hover:text-foreground"
          >
            {publishing === "vercel"
              ? "You'll need to run follow-up steps in Vercel."
              : "Turn on Pages in the repository's settings once it is pushed."}
          </a>
        </p>
      )}
    </QuestionnaireItem>
  );
}
