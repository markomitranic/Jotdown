"use client";

import { useState, type ReactNode } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useModifier } from "@jotdown/core/components/shortcuts";
import { settle } from "@jotdown/core/lib/settle";
import { Button } from "@jotdown/core/components/ui/button";
import { Questionnaire, QuestionnairePrevious } from "@jotdown/core/components/ui/questionnaire";
import { Key } from "../PaletteParts";
import {
  setupAnswersSchema,
  type ContentState,
  type Inspection,
  type SetupAnswers,
  type SetupPlan,
  type SetupTarget,
} from "@/lib/setup";
import { setupApi, type SetupApi } from "./api";
import { DoneStep } from "./DoneStep";
import { LookStep } from "./LookStep";
import { ReviewStep } from "./ReviewStep";
import { AgentsStep, FolderStep, NameStep, PagesStep, PublishingStep, nameProblems } from "./Steps";
import { TargetStep } from "./TargetStep";
import { WizardBody, WizardFooter, WizardFrame, type WizardStep } from "./WizardFrame";

type Props = {
  /** The target the wizard was opened for, from the switcher or a project with no docs yet. */
  start?: SetupTarget | null;
  onClose: () => void;
  /** Opens a project, the new one or one that has docs already, the way the switcher opens it. */
  onOpenProject: (key: string, title: string, bookmark: boolean) => void;
  api?: SetupApi;
};

/** The answers as they are being written, the target not chosen yet at first. */
export type Draft = Omit<SetupAnswers, "target"> & { target: SetupTarget | null; elsewhere: boolean };

const STEPS: WizardStep[] = [
  { id: "target", label: "Repository" },
  { id: "folder", label: "Content folder" },
  { id: "name", label: "Name" },
  { id: "look", label: "Look" },
  { id: "pages", label: "Pages" },
  { id: "agents", label: "Agents" },
  { id: "publishing", label: "Publishing" },
  { id: "review", label: "Review" },
];

const FIRST_DRAFT: Draft = {
  target: null,
  content: "",
  title: "",
  description: "",
  url: "",
  palette: "neutral",
  icon: null,
  pages: "starter",
  skills: true,
  agentNote: true,
  llms: true,
  assistants: true,
  publishing: "none",
  moveOld: false,
  elsewhere: false,
};

/**
 * The setup wizard: eight questions, a review of every file it will write, and one commit or one folder write that makes a project.
 *
 * The steps are one shadcn questionnaire: each a question with Back and Next
 * under it, Enter for Next, the arrow keys for moving and a letter for each
 * choice. Next and Create answer to the wizard's own checks, never the form's
 * native validation, which knows nothing of a repository being checked. Create alone takes a click or ⌘Enter, never a bare Enter, since it
 * commits to somebody's repository. Escape goes a step back, closing the
 * window from the first. The
 * target is checked as soon as it is picked, so a repository the studio
 * cannot write to says so on the first step, not the last. The review asks
 * the server what Create would write against the target as it is now, and
 * Create does exactly that.
 *
 * @example <SetupWizard onClose={closeSetup} onOpenProject={open} />
 */
export function SetupWizard({ start = null, onClose, onOpenProject, api = setupApi }: Props) {
  const [at, setAt] = useState(0);
  const [draft, setDraft] = useState<Draft>({ ...FIRST_DRAFT, target: start });
  const [touched, setTouched] = useState({ title: false, description: false });
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [filledFor, setFilledFor] = useState<string>();

  const steps = STEPS;
  const step = steps[Math.min(at, steps.length - 1)];
  if (!step) throw new Error("The setup wizard has no steps.");
  const modifier = useModifier();
  const queries = useQueryClient();
  const change = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const { target } = draft;
  const inspection = useQuery({
    queryKey: ["setup", "inspect", target],
    queryFn: target ? () => api.inspect(target) : skipToken,
  });

  const targetKey = JSON.stringify(target);
  if (inspection.data && filledFor !== targetKey) {
    setFilledFor(targetKey);
    fillFrom(inspection.data);
  }

  /** Fills what the target suggests into every answer nobody has typed yet. */
  function fillFrom(found: Inspection) {
    setDraft((current) => ({
      ...current,
      content: "",
      elsewhere: false,
      moveOld: false,
      title: touched.title || !found.title ? current.title : found.title,
      description: touched.description || !found.description ? current.description : found.description,
    }));
  }

  const askable = inspection.data !== undefined && setupAnswersSchema.shape.content.safeParse(draft.content).success;

  const holding = useQuery({
    queryKey: ["setup", "content", target, draft.content],
    queryFn:
      target && askable
        ? async ({ signal }) => {
            await settle(signal, 250);
            return api.inspectContent(target, draft.content);
          }
        : skipToken,
  });

  const answers = complete(draft);
  const plan = useQuery({
    queryKey: ["setup", "plan", answers],
    queryFn: step.id === "review" && answers ? () => api.plan(answers) : skipToken,
  });

  const create = useMutation({
    mutationFn: api.create,
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ["setup"], refetchType: "none" });
      void queries.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const created = create.data;

  const ready = readyToLeave(step.id, draft, inspection.data, holding.data, plan.data);

  const next = () => {
    if (created) return onOpenProject(created.key, created.title, draft.target?.kind === "github");
    if (!ready) return;
    if (step.id !== "review") return setAt(at + 1);
    if (answers && !create.isPending) create.mutate(answers);
  };

  if (created) {
    return (
      <WizardFrame steps={steps} at={steps.length} onStep={() => {}} onEscape={onClose} dismissable>
        <WizardBody at={steps.length}>
          <DoneStep
            done={created}
            target={draft.target}
            inspection={inspection.data ?? null}
            publishing={draft.publishing}
            moved={draft.moveOld ? draft.content : null}
            onOpenProject={() => onOpenProject(created.key, created.title, draft.target?.kind === "github")}
          />
        </WizardBody>
        <WizardFooter>
          <Hints>
            <span>
              <Key>Esc</Key> Close
            </span>
          </Hints>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => onOpenProject(created.key, created.title, draft.target?.kind === "github")}
          >
            Open {created.title}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </WizardFooter>
      </WizardFrame>
    );
  }

  const creating = create.isPending;
  const back = () => !creating && (at === 0 ? onClose() : setAt(at - 1));

  /** Follows the questionnaire to another step, forward only once this one is answered. */
  function follow(name: string) {
    const index = steps.findIndex((each) => each.id === name);
    if (index < 0 || creating || (index > at && !ready)) return;
    setAt(index);
  }

  return (
    <WizardFrame
      steps={steps}
      at={at}
      onStep={(index) => !creating && index < at && setAt(index)}
      onEscape={back}
      dismissable={at === 0}
    >
      <Questionnaire
        item={step.id}
        onItemChange={follow}
        shortcuts="letters"
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          if (step.id === "review") {
            event.preventDefault();
            if (event.metaKey || event.ctrlKey) next();
            return;
          }

          const field =
            event.target instanceof HTMLInputElement &&
            event.target.type !== "radio" &&
            event.target.type !== "checkbox";
          if (!field && !(event.target instanceof HTMLFieldSetElement)) return;
          event.preventDefault();
          if (ready) next();
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <WizardBody at={at}>
          <TargetStep
            api={api}
            target={draft.target}
            inspection={inspection}
            onTarget={(target) => change({ target })}
            onOpenProject={onOpenProject}
          />
          <FolderStep
            content={draft.content}
            elsewhere={draft.elsewhere}
            onContent={(content, elsewhere) =>
              change({ content, elsewhere, moveOld: draft.moveOld && content === draft.content })
            }
            holding={holding}
            moveOld={draft.moveOld}
            onMoveOld={(moveOld) => change({ moveOld })}
          />
          <NameStep
            draft={draft}
            onChange={(next) => {
              setTouched((current) => ({
                title: current.title || "title" in next,
                description: current.description || "description" in next,
              }));
              change(next);
            }}
          />
          <LookStep
            title={draft.title}
            palette={draft.palette}
            icon={iconPreview}
            onPalette={(palette) => change({ palette })}
            onIcon={(icon) => {
              setIconPreview(icon?.preview ?? null);
              change({ icon: icon?.base64 ?? null });
            }}
          />
          <PagesStep pages={draft.pages} content={draft.content} onPages={(pages) => change({ pages })} />
          <AgentsStep
            skills={draft.skills}
            agentNote={draft.agentNote}
            llms={draft.llms}
            assistants={draft.assistants}
            agentFile={inspection.data?.agentFile ?? null}
            onChange={change}
          />
          <PublishingStep publishing={draft.publishing} onPublishing={(publishing) => change({ publishing })} />
          <ReviewStep
            plan={plan}
            creating={creating}
            refusal={create.error?.message}
            promise={draft.moveOld ? "move" : "none"}
          />
        </WizardBody>

        <WizardFooter>
          {creating ? (
            <p className="min-w-0 flex-1 truncate text-muted-foreground text-xs" aria-live="polite">
              {draft.target?.kind === "folder" ? "Writing the files…" : "Committing to GitHub…"}
            </p>
          ) : (
            <Hints>
              {step.id === "review" ? (
                <span>
                  <Key>{modifier}</Key> <Key>Enter</Key> Create
                </span>
              ) : (
                <span>
                  <Key>Enter</Key> Next
                </span>
              )}
              <span>
                <Key>Esc</Key> {at === 0 ? "Close" : "Back"}
              </span>
              {CHOOSING.has(step.id) && (
                <span>
                  <Key>A</Key> <Key>B</Key> Choose
                </span>
              )}
            </Hints>
          )}
          <Button type="button" variant="ghost" disabled={creating} onClick={onClose}>
            Cancel
          </Button>
          <QuestionnairePrevious disabled={at === 0 || creating} className="col-auto row-auto">
            <ArrowLeft data-icon="inline-start" />
            Back
          </QuestionnairePrevious>
          {step.id === "review" ? (
            <Button type="button" disabled={!ready || creating} onClick={() => next()} className="min-w-24">
              {creating ? "Creating…" : create.isError ? "Try again" : "Create"}
            </Button>
          ) : (
            <Button type="button" disabled={!ready} onClick={() => next()} className="min-w-24">
              Next
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </WizardFooter>
      </Questionnaire>
    </WizardFrame>
  );
}

/** The steps answered by picking, whose answers take a letter. */
const CHOOSING = new Set(["folder", "look", "pages", "agents", "publishing"]);

/** The keys the window answers, as the switcher's footer names them. */
function Hints({ children }: { children: ReactNode }) {
  return <p className="flex min-w-0 flex-1 items-center gap-4 truncate text-muted-foreground text-xs">{children}</p>;
}

/**
 * Whether a step's question is answered well enough to go on, and for review, whether the plan has been worked out.
 *
 * @example readyToLeave("name", { ...draft, title: "" }, inspection, holding, plan); // false
 */
function readyToLeave(step: string, draft: Draft, inspection?: Inspection, holding?: ContentState, plan?: SetupPlan) {
  if (step === "target") return inspection !== undefined && inspection.problem === null;
  if (step === "folder")
    return (
      !(draft.elsewhere && draft.content === "") &&
      setupAnswersSchema.shape.content.safeParse(draft.content).success &&
      folderAnswered(draft, holding)
    );
  if (step === "name") return Object.values(nameProblems(draft)).every((problem) => !problem);
  if (step === "review") return plan !== undefined && complete(draft) !== null;
  return true;
}

/**
 * Whether what the content folder holds has been dealt with: nothing is in the way, or the editor chose to move it into `_old/`.
 *
 * @example folderAnswered({ ...draft, moveOld: false }, { kind: "occupied", … }); // false
 */
function folderAnswered(draft: Draft, holding?: ContentState) {
  return holding?.kind === "clear" || (holding?.kind === "occupied" && draft.moveOld);
}

/** The draft as answers the server takes, or null while one is missing or invalid. */
function complete(draft: Draft) {
  const parsed = setupAnswersSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}
