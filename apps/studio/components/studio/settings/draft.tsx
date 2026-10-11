"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONFIG_FILE, projectConfigSchema, type ProjectConfigInput } from "@jotdown/core/lib/config";
import { FetchFailure, fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import { useLeaveGuard } from "@jotdown/editor/client/useLeaveGuard";
import type { SaveResponse, SourceResponse } from "@jotdown/editor/types";
import { note } from "../status/note";
import { useSettings } from "./store";
import { changedPaths, commitMessage, tidy } from "@/lib/settings/config-draft";

/**
 * The settings draft: the config as it was read, and the text somebody is shaping it into.
 *
 * The draft is the file's own text, pinned to the config it was started from,
 * so a refresh of the saved config underneath cannot make a save quietly
 * overwrite somebody else's change. Every field edits it by parsing, changing
 * one key and writing it back, and the config file section edits it directly,
 * so the form and the raw file can never disagree. It outlives the panel: close
 * the settings and the draft theme stays on the page until it is saved or
 * thrown away.
 */

export type Config = ProjectConfigInput;

type Draft = {
  projectId: string;
  base: string;
  status: "idle" | "loading" | "failed" | "ready";
  problem: string | null;
  saved: Config;
  text: string;
  /** The draft as data, or null while its text is not a JSON object. */
  config: Config | null;
  /** Why the draft's text does not read as JSON, when it does not. */
  syntax: string | null;
  /** Every schema problem, keyed by the dotted path it is about. */
  issues: Map<string, string>;
  /** Every dotted path the draft changes from what was read. */
  changes: string[];
  dirty: boolean;
  update: (change: (config: Config) => Config) => void;
  setText: (text: string) => void;
  discard: () => void;
  save: () => void;
  /** Saves the draft over the newest config, for when somebody else changed it first. */
  overwrite: () => void;
  saving: boolean;
  saveProblem: { message: string; conflict: boolean } | null;
  reload: () => void;
};

const DraftContext = createContext<Draft | null>(null);

/**
 * Holds the open project's settings draft for everything inside it.
 *
 * Nothing is read until the settings first open, so a project nobody configures
 * costs no request.
 *
 * @example <SettingsDraft projectId={project.id} base={project.base}><SettingsPanel /></SettingsDraft>
 */
export function SettingsDraft({ projectId, base, children }: { projectId: string; base: string; children: ReactNode }) {
  const router = useRouter();
  const queries = useQueryClient();
  const { open } = useSettings();
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);

  /** The draft's own text and the config it was started from, or null while it follows the saved config. */
  const [edited, setEdited] = useState<{ text: string; from: SourceResponse | undefined } | null>(null);

  const read = useQuery({
    queryKey: ["settings", projectId, "config"],
    queryFn: () => fetchJson<SourceResponse>(`/api/projects/${projectId}/settings/config`),
    enabled: asked,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const saved = edited ? edited.from : read.data;
  const savedText = saved?.text ?? "";
  const draftText = edited?.text ?? savedText;
  const savedConfig = useMemo(() => parse(savedText).config ?? {}, [savedText]);
  const parsed = useMemo(() => parse(draftText), [draftText]);
  const issues = useMemo(() => schemaIssues(parsed.config), [parsed.config]);
  const changes = useMemo(
    () => (parsed.config ? changedPaths(savedConfig, parsed.config) : []),
    [savedConfig, parsed.config],
  );
  const dirty = saved !== undefined && draftText !== savedText;
  useLeaveGuard(dirty);

  const commit = useMutation({
    mutationFn: async ({ overwrite }: { overwrite: boolean }) => {
      const sha = overwrite
        ? (await fetchJson<SourceResponse>(`/api/projects/${projectId}/settings/config`)).sha
        : (saved?.sha ?? "");
      const body = {
        text: draftText.endsWith("\n") ? draftText : `${draftText}\n`,
        sha,
        message: commitMessage(changes),
      };
      const answer = await postJson<SaveResponse>(`/api/projects/${projectId}/settings/config`, body);
      return { text: body.text, sha: answer.sha };
    },
    onSuccess: async (written) => {
      queries.setQueryData<SourceResponse>(["settings", projectId, "config"], { path: CONFIG_FILE, ...written });
      setEdited(null);
      note("Saved the project settings");
      router.refresh();
      await queries.invalidateQueries({ queryKey: ["settings", projectId, "history"] });
    },
  });

  const failure = commit.error;
  const saveProblem = failure
    ? {
        message: failure.message,
        conflict: failure instanceof FetchFailure && "conflict" in failure.answer,
      }
    : null;

  const draft: Draft = {
    projectId,
    base,
    status: !asked ? "idle" : read.isError ? "failed" : saved ? "ready" : "loading",
    problem: read.error?.message ?? null,
    saved: savedConfig,
    text: draftText,
    config: parsed.config,
    syntax: parsed.syntax,
    issues,
    changes,
    dirty,
    update: (change) => {
      commit.reset();
      setEdited((previous) => {
        const current = parse(previous?.text ?? savedText).config;
        if (!current) return previous;
        return { text: `${JSON.stringify(tidy(change(current)), null, 2)}\n`, from: previous ? previous.from : saved };
      });
    },
    setText: (next) => {
      commit.reset();
      setEdited((previous) => ({ text: next, from: previous ? previous.from : saved }));
    },
    discard: () => {
      commit.reset();
      setEdited(null);
    },
    save: () => commit.mutate({ overwrite: false }),
    overwrite: () => commit.mutate({ overwrite: true }),
    saving: commit.isPending,
    saveProblem,
    reload: () => {
      commit.reset();
      setEdited(null);
      void read.refetch();
    },
  };

  return <DraftContext value={draft}>{children}</DraftContext>;
}

/**
 * The settings draft around this component.
 *
 * @example const { config, update } = useDraft();
 */
export function useDraft() {
  const draft = use(DraftContext);
  if (!draft) throw new Error("useDraft runs inside <SettingsDraft>.");
  return draft;
}

function parse(text: string): { config: Config | null; syntax: string | null } {
  if (!text.trim()) return { config: {}, syntax: null };
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { config: null, syntax: "The config has to be one JSON object, in braces." };
    }
    return { config: value as Config, syntax: null };
  } catch (error) {
    return { config: null, syntax: error instanceof Error ? error.message : "This is not valid JSON." };
  }
}

function schemaIssues(config: Config | null) {
  const issues = new Map<string, string>();
  if (!config) return issues;
  const checked = projectConfigSchema.safeParse(config);
  if (checked.success) return issues;
  for (const issue of checked.error.issues) issues.set(issue.path.join("."), issue.message);
  return issues;
}
