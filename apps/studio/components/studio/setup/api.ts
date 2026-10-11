import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import type { ContentState, Inspection, SetupAnswers, SetupDone, SetupPlan, SetupTarget } from "@/lib/setup";

/**
 * The wizard's calls to the studio, each answering its result or throwing the studio's reason.
 */

/** Everything the wizard asks of the server, so a story can answer it from memory. */
export type SetupApi = {
  listRepositories: () => Promise<string[]>;
  inspect: (target: SetupTarget) => Promise<Inspection>;
  inspectContent: (target: SetupTarget, content: string) => Promise<ContentState>;
  plan: (answers: SetupAnswers) => Promise<SetupPlan>;
  create: (answers: SetupAnswers) => Promise<SetupDone>;
};

const SETUP = "/api/setup";

export const setupApi: SetupApi = {
  listRepositories: async () =>
    (await fetchJson<{ repositories: string[] }>(SETUP, { cache: "no-store" })).repositories,
  inspect: (target) => postJson(SETUP, { action: "inspect", target }),
  inspectContent: (target, content) => postJson(SETUP, { action: "content", target, content }),
  plan: (answers) => postJson(SETUP, { action: "plan", answers }),
  create: (answers) => postJson(SETUP, { action: "create", answers }),
};
