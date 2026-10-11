import { useEffect } from "react";
import { http, HttpResponse } from "msw";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import type { Inspection, SetupPlan, SetupTarget } from "@/lib/setup";
import type { FolderListing } from "../folders";
import type { SetupApi } from "./api";
import { Dialog as DialogPrimitive } from "radix-ui";
import { DoneStep } from "./DoneStep";
import { SetupDialog } from "./SetupDialog";
import { openSetup } from "./store";
import { WizardBody, WizardFrame } from "./WizardFrame";

const REPOSITORIES = ["acme/checkout-web", "acme/design-system", "acme/handbook", "acme/web-platform", "grace/notes"];

const FOUND: Inspection = {
  target: { kind: "github", key: "acme/checkout-web" },
  name: "acme/checkout-web",
  title: "Checkout web",
  description: "The checkout flow for the web shop",
  branch: "main",
  repository: "https://github.com/acme/checkout-web",
  agentFile: "AGENTS.md",
  problem: null,
};

const PLAN: SetupPlan = {
  destination: { kind: "github", branch: "main", editor: "octocat" },
  files: [
    { path: ".jotdown/config.json", change: "new" },
    { path: "apps/docs/docs/index.mdx", change: "new" },
    { path: "apps/docs/docs/meta.json", change: "new" },
    { path: "apps/docs/docs/getting-started/index.mdx", change: "new" },
    { path: "apps/docs/docs/architecture/index.mdx", change: "new" },
    { path: "apps/docs/docs/decision-records/index.mdx", change: "new" },
    { path: ".agents/skills/authoring/SKILL.md", change: "new" },
    { path: ".agents/skills/blocks/SKILL.md", change: "replaced" },
    { path: ".claude/skills/authoring/SKILL.md", change: "new" },
    { path: ".claude/skills/blocks/SKILL.md", change: "new" },
    { path: "AGENTS.md", change: "appended" },
    { path: "CLAUDE.md", change: "kept" },
  ],
};

const LISTING: FolderListing = {
  path: "/Users/ada/Sites",
  display: "~/Sites",
  title: null,
  parent: "/Users/ada",
  entries: [
    { name: "checkout-web", path: "/Users/ada/Sites/checkout-web", title: null },
    { name: "handbook", path: "/Users/ada/Sites/handbook", title: "Handbook" },
    { name: "web-platform", path: "/Users/ada/Sites/web-platform", title: null },
  ],
};

type Answer = "found" | "unreachable" | "configured" | "failing";

/** The wizard's server, answering from memory a moment after it is asked. */
function memoryApi(answer: Answer): SetupApi {
  const later = <T,>(value: T) => new Promise<T>((done) => setTimeout(() => done(value), 400));
  const inspected = (target: SetupTarget): Inspection => {
    const name = target.kind === "github" ? target.key : "~/Sites/checkout-web";
    const found = { ...FOUND, target, name };
    if (answer === "unreachable")
      return {
        ...found,
        problem: {
          kind: "unreachable",
          message: `GitHub shows no ${name}. It does not exist, or your account cannot see it.`,
        },
      };
    if (answer === "configured")
      return {
        ...found,
        problem: { kind: "configured", message: `${name} is a Jotdown project already.`, open: `/${name}` },
      };
    return found;
  };

  return {
    listRepositories: () => later(REPOSITORIES),
    inspect: (target) => later(inspected(target)),
    inspectContent: () => later({ kind: "clear" }),
    plan: () => later(PLAN),
    create: async () => {
      await later(null);
      if (answer === "failing") throw new Error("Somebody pushed while the project was being set up. Create it again.");
      return { key: FOUND.name, title: FOUND.title, files: PLAN.files };
    },
  };
}

/** The window as the studio mounts it, opened on the target a story names. */
function Playground({ answer = "found", start = null }: { answer?: Answer; start?: SetupTarget | null }) {
  useEffect(() => openSetup(start), [start]);
  return <SetupDialog onOpenProject={fn()} api={memoryApi(answer)} />;
}

const meta = preview.meta({
  title: "Studio/Setup wizard",
  component: Playground,
  parameters: { layout: "fullscreen" },
  beforeEach: ({ msw }) => {
    msw.use(http.get("/api/folders", () => HttpResponse.json(LISTING)));
  },
});

/** The first question: the editor's repositories, searched as they type. */
export const Repository = meta.story();

/** A repository picked and checked: its default branch, and that the editor can commit to it. */
export const Checked = meta.story({ args: { start: FOUND.target } });

/** A folder on this computer, set up instead of a repository. */
export const Folder = meta.story({
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("tab", { name: "Folder on this computer" }));
  },
});

/** A repository GitHub will not show the editor, named as GitHub answers for it. */
export const NoAccess = meta.story({ args: { answer: "unreachable", start: FOUND.target } });

/** The repository has docs already, so it offers to open them instead. */
export const HasDocs = meta.story({ args: { answer: "configured", start: FOUND.target } });

/** Presses Next once it is enabled, since a step disables it while its checks are in flight. */
async function pressNext() {
  const next = await within(document.body).findByRole("button", { name: "Next" });
  await waitFor(() => expect(next).toBeEnabled());
  await userEvent.click(next);
}

/** Next answers every question with its default, up to the review of every file. */
export const Review = meta.story({
  args: { start: FOUND.target },
  play: async () => {
    const page = within(document.body);
    await page.findByText(/^Default branch main/);
    for (let step = 0; step < 7; step++) await pressNext();
    await page.findByText("One commit straight to main, as octocat.");
  },
});

/** Create refused because the branch moved, with the plan dimmed behind the reason and a way to try again. */
export const CreateFailed = meta.story({
  args: { answer: "failing", start: FOUND.target },
  play: async () => {
    const page = within(document.body);
    await page.findByText(/^Default branch main/);
    for (let step = 0; step < 7; step++) await pressNext();
    await page.findByText("One commit straight to main, as octocat.");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await page.findByRole("button", { name: /Try again/ });
  },
});

/** The end: what was written, and the next steps. */
export const Done = meta.story({
  render: () => (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <WizardFrame
          steps={[
            { id: "target", label: "Repository" },
            { id: "review", label: "Review" },
          ]}
          at={2}
          onStep={fn()}
          onEscape={fn()}
          dismissable
        >
          <WizardBody at={2}>
            <DoneStep
              done={{ key: FOUND.name, title: FOUND.title, files: PLAN.files }}
              target={FOUND.target}
              inspection={FOUND}
              publishing="vercel"
              onOpenProject={fn()}
            />
          </WizardBody>
        </WizardFrame>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  ),
});
