"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "cn";
import { Bot, Braces, FileCog, FileText, GitCommitHorizontal, HardDrive, Image, Rocket, Sparkles } from "lucide-react";
import { Badge } from "@jotdown/core/components/ui/badge";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@jotdown/core/components/ui/item";
import { QuestionnaireItem } from "@jotdown/core/components/ui/questionnaire";
import { OLD_FOLDER, type Destination, type PlannedFile, type SetupPlan } from "@/lib/setup";
import { Question } from "./Choices";

/** What each change is called, and how loudly its badge says it. */
const CHANGES: Record<
  PlannedFile["change"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  new: { label: "New", variant: "secondary" },
  appended: { label: "Adds a section", variant: "secondary" },
  replaced: { label: "Updated", variant: "secondary" },
  kept: { label: "Kept as it is", variant: "outline" },
  moved: { label: "Moved", variant: "secondary" },
  deleted: { label: "Deleted", variant: "destructive" },
};

/** What happens to files already there: nothing, or a move into `_old/`. */
type Promised = "none" | "move";

type Props = {
  plan: UseQueryResult<SetupPlan>;
  /** Whether Create is under way, which dims the plan behind it. */
  creating: boolean;
  /** Why the last Create was refused, shown above the files. */
  refusal?: string;
  promise: Promised;
};

/** What the review promises about files already there, by what happens to them. */
const PROMISES: Record<Promised, string> = {
  none: "Nothing is written until you press Create. A file already there is never overwritten.",
  move: `Nothing is written until you press Create. What the folder held moves into ${OLD_FOLDER}/, and nothing in it is overwritten.`,
};

/**
 * Every file Create will write and where it lands, as the server works it out against the target now.
 *
 * The skills are dozens of files, so each of their two folders is one row with a count.
 *
 * @example <ReviewStep plan={useQuery(planQuery)} creating={false} promise="none" />
 */
export function ReviewStep({ plan, creating, refusal, promise }: Props) {
  return (
    <QuestionnaireItem name="review">
      <Question title="Ready to create them?" description={PROMISES[promise]} />
      <Plan plan={plan} creating={creating} refusal={refusal} />
    </QuestionnaireItem>
  );
}

function Plan({ plan, creating, refusal }: Omit<Props, "promise">) {
  if (plan.error && !plan.data)
    return (
      <p role="alert" className="text-destructive text-sm">
        {plan.error.message}
      </p>
    );
  if (!plan.data)
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Working out what to write…
      </p>
    );

  const { files, destination } = plan.data;
  const rows = grouped(files);
  const written = files.filter(
    (file) => file.change !== "kept" && file.change !== "moved" && file.change !== "deleted",
  ).length;
  const moved = files.filter((file) => file.change === "moved").length;
  const deleted = files.filter((file) => file.change === "deleted").length;
  const kept = files.length - written - moved - deleted;

  return (
    <div className={cn("flex flex-col gap-3", creating && "opacity-60")}>
      <Landing destination={destination} />
      <p className="text-muted-foreground text-sm">
        {[
          `${written === 1 ? "1 file" : `${written} files`} written`,
          moved > 0 && `${moved} moved`,
          deleted > 0 && `${deleted} deleted`,
          kept > 0 && `${kept} kept as they are`,
        ]
          .filter(Boolean)
          .join(", ")}
        .
      </p>

      {refusal && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {refusal}
        </p>
      )}

      <ul aria-label="Files" className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => {
          const Icon = iconOf(row.path);
          return (
            <li
              key={`${row.change}:${row.from ?? ""}:${row.path}`}
              className="flex h-9 items-center gap-2.5 px-3 text-sm"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono text-[0.8125rem]",
                  (row.change === "kept" || row.change === "deleted") && "text-muted-foreground",
                  row.change === "deleted" && "line-through",
                )}
              >
                {row.from && <span className="text-muted-foreground">{row.from} → </span>}
                {row.path}
              </span>
              {row.count > 1 && (
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {row.count} {row.unit}
                </span>
              )}
              <Badge
                variant={CHANGES[row.change].variant}
                className={cn(row.change === "new" && "bg-primary/12 text-primary")}
              >
                {CHANGES[row.change].label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Where Create writes: a folder on this machine, or one commit onto a repository's default branch.
 *
 * @example <Landing destination={{ kind: "github", branch: "main", editor: "ada" }} />
 */
function Landing({ destination }: { destination: Destination }) {
  const folder = destination.kind === "folder";

  return (
    <Item variant="muted" size="sm" className="bg-foreground/4">
      <ItemMedia variant="icon">{folder ? <HardDrive /> : <GitCommitHorizontal />}</ItemMedia>
      <ItemContent>
        <ItemTitle>
          {folder
            ? `Written into ${destination.name}. Nothing is committed.`
            : `One commit straight to ${destination.branch}, as ${destination.editor}.`}
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}

/**
 * The icon a file is listed with, by what it is.
 *
 * @example iconOf("docs/index.mdx"); // FileText
 */
function iconOf(path: string) {
  if (/skills\/$/.test(path)) return Sparkles;
  if (/^(AGENTS|CLAUDE)\.md$/.test(path)) return Bot;
  if (path === ".jotdown/config.json") return FileCog;
  if (/^(\.jotdown\/(vercel\.json|\.gitignore)|\.github\/workflows\/jotdown\.yml)$/.test(path)) return Rocket;
  if (/\.(png|svg|webp|jpe?g)$/.test(path)) return Image;
  if (/\.json$/.test(path)) return Braces;
  return FileText;
}

/**
 * The files as rows: each skills folder folded into one, and every move between the same two folders folded into one, counted.
 *
 * Moving a folder's content into `_old/` moves it one entry at a time, so a
 * big folder would list every entry; folded, it reads as the folder it is.
 *
 * @example grouped([{ path: "docs/a.mdx", from: "apps/docs/docs/a.mdx", change: "moved" }, { path: "docs/b", from: "apps/docs/docs/b", change: "moved" }]); // [{ path: "docs/", from: "apps/docs/docs/", count: 2, … }]
 */
function grouped(files: PlannedFile[]) {
  const rows: (PlannedFile & { count: number; unit: string })[] = [];

  for (const file of files) {
    const skills = /^(\.agents|\.claude)\/skills\//.exec(file.path)?.[0];
    const moved =
      file.change === "moved" && file.from ? { path: `${parent(file.path)}/`, from: `${parent(file.from)}/` } : null;
    const path = skills ?? moved?.path ?? file.path;
    const known =
      (skills || moved) &&
      rows.find((row) => row.path === path && row.change === file.change && row.from === moved?.from);
    if (known) {
      known.count += 1;
      if (file.change === "new") known.change = "new";
      continue;
    }
    rows.push({
      path,
      change: file.change,
      count: 1,
      unit: skills ? "files" : "items",
      ...(moved ? { from: moved.from } : file.from && { from: file.from }),
    });
  }

  return rows.map((row) => (row.count === 1 && row.from?.endsWith("/") ? { ...row, ...single(files, row) } : row));
}

/** A folded row that folded only one move back into the move itself. */
function single(files: PlannedFile[], row: PlannedFile) {
  const file = files.find(
    (each) =>
      each.change === "moved" &&
      each.from &&
      `${parent(each.from)}/` === row.from &&
      `${parent(each.path)}/` === row.path,
  );
  return file ? { path: file.path, from: file.from } : {};
}

/**
 * The folder a path sits in, or `.` at the repository root.
 *
 * @example parent("apps/docs/docs/index.mdx"); // "apps/docs/docs"
 */
function parent(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
}
