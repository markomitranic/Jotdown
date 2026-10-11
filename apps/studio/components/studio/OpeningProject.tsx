"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "cn";
import { Check, FileText, FolderOpen, Laptop, X } from "lucide-react";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { Button } from "@jotdown/core/components/ui/button";
import { optimizable } from "@jotdown/core/lib/images";
import { formatProjectKey, type ProjectKey } from "@/lib/project-key";
import type { rememberedLook } from "@/server/projects/context";
import { OPENING_STEPS, type Opening, type OpeningStep, type ProjectLook } from "./projects";
import styles from "./OpeningProject.module.css";

const LABELS: Record<OpeningStep, string> = {
  reading: "Reading the key",
  finding: "Finding it on GitHub",
  branding: "Trying on its colours",
  downloading: "Downloading the docs folder",
  compiling: "Unpacking and compiling the pages",
};

const LINES: Record<OpeningStep, string[]> = {
  reading: ["Unfolding the key to see what's inside", "Telling the owner apart from the repository"],
  finding: [
    "Knocking on GitHub's door",
    "Checking that you are allowed in",
    "Asking which branch the edits land on",
    "Looking up the latest commit",
  ],
  branding: ["Borrowing the project's colours", "Picking up the logo", "Trying the brand on for size"],
  downloading: [
    "Packing the docs folder into a box",
    "Carrying the pages over, a few at a time",
    "Picking up .jotdown/config.json on the way out",
    "Leaving the images on GitHub until a page asks for them",
  ],
  compiling: [
    "Unpacking the box",
    "Putting the pages in sidebar order",
    "Checking that no page tries to run code",
    "Turning markdown into pages",
    "Straightening the last page",
  ],
};

/** What changes when the project is a folder on this machine: it is found and read there, not on GitHub. */
const FOLDER_LABELS: Record<OpeningStep, string> = {
  ...LABELS,
  finding: "Finding the folder",
  downloading: "Reading the docs folder",
};

const FOLDER_LINES: Record<OpeningStep, string[]> = {
  ...LINES,
  finding: ["Looking in the folder", "Checking it is still a Jotdown project"],
  downloading: ["Reading the pages straight off the disk", "Picking up .jotdown/config.json on the way"],
};

const STARTING_LINES = [
  "Waking the studio up",
  "Looking up the latest commit",
  "Carrying the pages over, a few at a time",
  "Putting the pages in sidebar order",
  "Turning markdown into pages",
];

const LINE_MS = 2400;

const FRAME = "fixed inset-0 z-100 grid place-items-center bg-background px-6 text-foreground";

/**
 * The full-screen wait while a project opens, drawn over the page it replaces.
 *
 * Every step is a real one the opener goes through, so the list only ticks
 * when the step has happened. Once the project's brand arrives the screen
 * eases into its colours, and its logo takes the folder's place. When a step fails, it says
 * what GitHub said and offers the way back.
 *
 * @example {opening && <OpeningProject opening={opening} onDismiss={dismiss} />}
 */
export function OpeningProject({ opening, onDismiss }: { opening: Opening; onDismiss: () => void }) {
  const { step, problem } = opening;
  const folder = opening.parts?.owner === "local";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-project-title"
      aria-busy={!problem}
      className={cn(FRAME, "animate-fade-in", styles.wearing)}
    >
      <OpeningScreen opening={opening} steps animateLogo>
        {problem ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-destructive text-sm">
              {problem}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={onDismiss} autoFocus>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <RotatingLine key={step} lines={(folder ? FOLDER_LINES : LINES)[step]} />
        )}
      </OpeningScreen>
    </div>,
    document.body,
  );
}

/**
 * The first screen of a cold start, while the server opens the project the address names.
 *
 * In the look the switcher remembered for the project, its title, logo and
 * colours. Right after the switcher downloaded it, this is the switcher's own
 * screen carrying on at the compile, so the reload between them reads as one
 * wait. Otherwise it names the project and carries pages across without
 * claiming a step. React never runs a fallback the server sent, so its lines
 * take turns in CSS alone.
 *
 * @example <Suspense fallback={<StartingUp parts={parseProjectKey("you/notes")!} look={null} />}>…</Suspense>
 */
export function StartingUp({ parts, look }: { parts: ProjectKey; look: Awaited<ReturnType<typeof rememberedLook>> }) {
  const opened = look?.opened ?? false;
  const opening: Opening = {
    key: formatProjectKey(parts),
    title: look?.title ?? null,
    parts,
    step: opened ? "compiling" : "downloading",
    found: look?.found ?? null,
    look: look && { title: look.title, logo: look.logo },
    problem: null,
  };

  return (
    <>
      {look?.theme && <style>{look.theme}</style>}
      <div role="status" className={FRAME}>
        <OpeningScreen opening={opening} steps={opened} animateLogo={false}>
          <p className="grid h-5 text-center text-muted-foreground text-sm">
            {(opened ? LINES.compiling : STARTING_LINES).map((line, index) => (
              <span key={line} className={styles.turn} style={{ animationDelay: `${index * LINE_MS}ms` }}>
                {line}…
              </span>
            ))}
          </p>
        </OpeningScreen>
      </div>
    </>
  );
}

type ScreenProps = { opening: Opening; steps: boolean; animateLogo: boolean; children: ReactNode };

/** The journey, the project's name and key, the steps when they are known, and a line about the work under way. */
function OpeningScreen({ opening, steps, animateLogo, children }: ScreenProps) {
  const { parts, step, problem, look } = opening;
  const title = look?.title ?? opening.title ?? parts?.repo ?? opening.key;
  const folder = parts?.owner === "local";

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Journey step={step} failed={problem !== null} look={look} folder={folder} animateLogo={animateLogo} />

      <header className="space-y-1.5 text-center">
        <h2 id="opening-project-title" className="font-semibold text-lg">
          {problem ? `${title} did not open` : `Opening ${title}`}
        </h2>
        <KeyParts parts={parts} fallback={opening.key} />
      </header>

      {steps && (
        <ol className="space-y-2.5 text-sm">
          {OPENING_STEPS.map((each) => (
            <StepRow key={each} step={each} opening={opening} label={(folder ? FOLDER_LABELS : LABELS)[each]} />
          ))}
        </ol>
      )}

      {children}
    </div>
  );
}

/** Where the project comes from, GitHub or this computer, where it goes, and the pages on their way between the two. */
function Journey({
  step,
  failed,
  look,
  folder,
  animateLogo,
}: {
  step: OpeningStep;
  failed: boolean;
  look: ProjectLook | null;
  folder: boolean;
  animateLogo: boolean;
}) {
  const carrying = !failed && (step === "downloading" || step === "compiling");
  const arriving = !failed && step === "compiling";

  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <div
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-xl border bg-card text-foreground shadow-sm [&_svg]:size-7",
          !failed && step === "finding" ? "border-primary" : "border-border",
        )}
      >
        {folder ? <Laptop /> : <GitHubMark />}
      </div>

      <div className="relative h-8 flex-1 text-primary">
        <div className="absolute inset-x-0 top-1/2 border-border border-t-2 border-dashed" />
        {carrying && (
          <>
            <span className={styles.page}>
              <FileText className="size-4" />
            </span>
            <span className={styles.page}>
              <FileText className="size-4" />
            </span>
            <span className={styles.page}>
              <FileText className="size-4" />
            </span>
          </>
        )}
      </div>

      <div
        className={cn(
          "grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card shadow-sm [&_svg]:size-7",
          arriving ? "border-primary text-primary" : "border-border text-muted-foreground",
        )}
      >
        {look?.logo ? <Logo logo={look.logo} animate={animateLogo} /> : <FolderOpen />}
      </div>
    </div>
  );
}

/** The project's logo, fitted into the destination tile, in the colour mode's variant, settling in when it arrives. */
function Logo({ logo, animate }: { logo: NonNullable<ProjectLook["logo"]>; animate: boolean }) {
  return (
    <>
      <Image
        src={logo.src}
        alt=""
        width={40}
        height={32}
        unoptimized={!optimizable(logo.src)}
        className={cn("max-h-8 max-w-10 object-contain dark:hidden", animate && styles.arrive)}
      />
      <Image
        src={logo.srcDark}
        alt=""
        width={40}
        height={32}
        unoptimized={!optimizable(logo.srcDark)}
        className={cn("hidden max-h-8 max-w-10 object-contain dark:block", animate && styles.arrive)}
      />
    </>
  );
}

/** The key the editor asked for, laid out as the parts it was read into, or as typed when it would not read. */
function KeyParts({ parts, fallback }: { parts: ProjectKey | null; fallback: string }) {
  if (!parts) return <p className="font-mono text-muted-foreground text-xs">{fallback}</p>;

  return (
    <p className="flex flex-wrap justify-center gap-1 font-mono text-muted-foreground text-xs">
      <span className="rounded bg-secondary px-1.5 py-0.5">{parts.owner}</span>
      <span className="rounded bg-secondary px-1.5 py-0.5">{parts.repo}</span>
    </p>
  );
}

/** One step: done, under way, failed, or still to come, with what it found once it is done. */
function StepRow({ step, opening, label }: { step: OpeningStep; opening: Opening; label: string }) {
  const at = OPENING_STEPS.indexOf(opening.step);
  const index = OPENING_STEPS.indexOf(step);
  const state = index < at ? "done" : index > at ? "waiting" : opening.problem ? "failed" : "active";
  const found = step === "finding" && state === "done" && opening.found;

  return (
    <li className={cn("flex items-center gap-3", state === "waiting" && "text-muted-foreground")}>
      <span className="grid size-5 shrink-0 place-items-center">
        {state === "done" && <Check className="size-4 text-primary" />}
        {state === "active" && <span className="size-2 rounded-full bg-primary ring-4 ring-primary/20" />}
        {state === "failed" && <X className="size-4 text-destructive" />}
        {state === "waiting" && <span className="size-1.5 rounded-full bg-border" />}
      </span>
      <span className={cn(state === "active" && "font-medium")}>{label}</span>
      {found && (
        <span className="ms-auto font-mono text-muted-foreground text-xs">
          {found.branch} · {found.head.slice(0, 7)}
        </span>
      )}
    </li>
  );
}

/** A friendly line about the work under way, a new one every couple of seconds. */
function RotatingLine({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => current + 1), LINE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <p aria-live="polite" className="h-5 text-center text-muted-foreground text-sm">
      <span key={index} className={cn("inline-block", styles.line)}>
        {lines[index % lines.length]}…
      </span>
    </p>
  );
}
