"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { CircleAlert, CircleCheck, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jotdown/core/components/ui/select";
import { Switch } from "@jotdown/core/components/ui/switch";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import type { Branches } from "@/server/projects/branches";
import type { HealthCheck } from "@/server/settings/health";
import { type Config, useDraft } from "./draft";
import { valueAt, withValue } from "@/lib/settings/config-draft";
import { SettingsBlock, SettingsGroup, SettingsRow, TextSetting } from "./parts";

/**
 * What the project is called, where it lives and where it is published, with a check that each of those answers.
 *
 * @example <GeneralSection />
 */
export function GeneralSection() {
  const [advanced, setAdvanced] = useState(false);

  return (
    <>
      <Health />

      <SettingsGroup title="Project">
        <SettingsRow label="Title" description="The sidebar, the window and every page's title bar." paths={["title"]}>
          <TextSetting path="title" placeholder="Documentation" className="w-72" />
        </SettingsRow>
        <SettingsRow
          label="Description"
          description="What the project is, for search engines and link previews."
          paths={["description"]}
          stacked
        >
          <TextSetting path="description" placeholder="How to write, edit and publish with Jotdown." />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Where it lives">
        <SettingsRow
          label="Site address"
          description="Where the publication is served."
          paths={["url"]}
          keywords="url domain"
        >
          <TextSetting path="url" placeholder="https://docs.example.com" className="w-72" type="url" />
        </SettingsRow>
        <SettingsRow
          label="Repository"
          description="Where the edit and history links point."
          paths={["repository"]}
          keywords="github url"
        >
          <TextSetting path="repository" placeholder="https://github.com/you/docs" className="w-72" type="url" />
        </SettingsRow>
        <SettingsRow label="Branch" description="The branch a publication builds from." paths={["branch"]}>
          <BranchSetting />
        </SettingsRow>
        <SettingsRow
          label="Prerender pages"
          description="The build writes every page ahead, instead of each on its first visit."
          paths={["prerender"]}
          keywords="build static vercel deploy"
        >
          <PrerenderSetting />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="For agents">
        <SettingsRow
          label="llms.txt"
          description="The site serves an index of every page, for agents to read the docs from."
          paths={["features.llms"]}
          keywords="ai llm index features"
        >
          <FeatureSetting path="features.llms" label="llms.txt" />
        </SettingsRow>
        <SettingsRow
          label="Open in assistants"
          description="Each page's menu offers Open in Claude, ChatGPT and Cursor."
          paths={["features.assistants"]}
          keywords="ai claude chatgpt cursor features menu"
        >
          <FeatureSetting path="features.assistants" label="Open in assistants" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Advanced"
        action={
          <Button variant="ghost" size="xs" aria-expanded={advanced} onClick={() => setAdvanced((shown) => !shown)}>
            {advanced ? "Hide" : "Show"}
          </Button>
        }
      >
        {advanced ? (
          <>
            <SettingsRow
              label="Default layout"
              description="The layout a page is drawn in when its front matter names none."
              paths={["layout"]}
            >
              <TextSetting path="layout" placeholder="docs" className="w-48 font-mono text-xs" />
            </SettingsRow>
            <SettingsRow
              label="Content folder"
              description="The folder holding docs/, when it is not the repository's root."
              paths={["content"]}
              keywords="subfolder monorepo"
            >
              <TextSetting path="content" placeholder="The repository root" className="w-48 font-mono text-xs" />
            </SettingsRow>
            <SettingsRow
              label="Uploads folder"
              description="Where images, files and fonts are kept."
              paths={["uploads"]}
            >
              <TextSetting path="uploads" placeholder="docs/_uploads" className="w-48 font-mono text-xs" />
            </SettingsRow>
          </>
        ) : (
          <SettingsRow
            label="Layout, content and uploads folders"
            description="Rarely changed. Moving a folder here does not move its files."
            paths={["layout", "content", "uploads"]}
            keywords="layout content uploads folder subfolder"
          />
        )}
      </SettingsGroup>
    </>
  );
}

/**
 * A switch for one of the site's features, on unless the config says `false`, and taken out of the config when turned back on.
 *
 * @example <FeatureSetting path="features.llms" label="llms.txt" />
 */
function FeatureSetting({ path, label }: { path: string; label: string }) {
  const { config, update } = useDraft();

  return (
    <Switch
      aria-label={label}
      checked={valueAt(config, path) !== false}
      onCheckedChange={(on) => update((current) => withValue(current, path, on ? undefined : false))}
    />
  );
}

/**
 * A switch for writing every page at build time, off unless the config says `true`, and taken out of the config when turned off.
 *
 * @example <PrerenderSetting />
 */
function PrerenderSetting() {
  const { config, update } = useDraft();

  return (
    <Switch
      aria-label="Prerender pages"
      checked={valueAt(config, "prerender") === true}
      onCheckedChange={(on) => update((current) => withValue(current, "prerender", on || undefined))}
    />
  );
}

/** The branch picker's choice for leaving `branch` out, which no git branch can be called. */
const DEFAULT_BRANCH = "\0default";

/** The branch to publish from, out of the ones the project has, or its default. */
function BranchSetting() {
  const { config, update, projectId } = useDraft();
  const branches = useQuery({
    queryKey: ["studio", "branches", projectId],
    queryFn: () => fetchJson<Branches>(`/api/projects/${projectId}/branches`),
  });
  const chosen = config?.branch;
  const listed = [...new Set([...(branches.data?.branches ?? []), ...(chosen ? [chosen] : [])])];
  const home = branches.data?.home ?? branches.data?.current;

  return (
    <Select
      value={chosen ?? DEFAULT_BRANCH}
      onValueChange={(value) =>
        update((current) => withValue(current, "branch", value === DEFAULT_BRANCH ? undefined : value))
      }
    >
      <SelectTrigger className="w-56" aria-label="Branch">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_BRANCH}>{home ? `The default, ${home}` : "The default branch"}</SelectItem>
        {listed.map((branch) => (
          <SelectItem key={branch} value={branch}>
            {branch}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The addresses health checks, out of a draft. */
function addressesOf(config: Config | null) {
  const files = [
    config?.favicon,
    config?.logo?.src,
    config?.logo?.srcDark,
    ...Object.values(config?.theme?.fonts ?? {}).map((font) => font?.src),
  ];
  return {
    repository: config?.repository,
    url: config?.url,
    branch: config?.branch,
    files: [...new Set(files.filter((file): file is string => Boolean(file)))],
  };
}

/**
 * Whether the draft's addresses answer, asked again a moment after somebody stops typing.
 *
 * @example <Health />
 */
function Health() {
  const { config, update, projectId } = useDraft();
  const addresses = useSettled(addressesOf(config), 700);

  const health = useQuery({
    queryKey: ["settings", projectId, "health", addresses],
    queryFn: () => postJson<HealthCheck[]>(`/api/projects/${projectId}/settings/health`, addresses),
    staleTime: 60_000,
  });

  return (
    <SettingsGroup
      title="Health"
      action={
        <Button variant="ghost" size="xs" disabled={health.isFetching} onClick={() => health.refetch()}>
          <RotateCw className={cn(health.isFetching && "animate-spin")} aria-hidden="true" />
          Check again
        </Button>
      }
    >
      <SettingsBlock keywords="health check status repository branch site files">
        {health.isPending && (
          <p className="flex items-center gap-2 px-4 py-3.5 text-muted-foreground text-sm">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Asking the repository, the branch and the site…
          </p>
        )}
        {health.isError && <p className="px-4 py-3.5 text-destructive text-sm">{health.error.message}</p>}
        {health.data && (
          <ul className="grid gap-px bg-border sm:grid-cols-2">
            {health.data.map(({ id, state, text, fix }) => (
              <li key={id} className="flex items-start gap-2.5 bg-card px-4 py-3">
                <HealthIcon state={state} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-sm">{HEALTH_LABELS[id]}</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">{text}</span>
                  {fix && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="mt-1.5 self-start"
                      onClick={() => update((current) => withValue(current, fix.field, fix.value))}
                    >
                      Use {fix.value.replace(/^https:\/\//, "")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {health.data.length % 2 === 1 && <li aria-hidden="true" className="bg-card max-sm:hidden" />}
          </ul>
        )}
      </SettingsBlock>
    </SettingsGroup>
  );
}

const HEALTH_LABELS: Record<HealthCheck["id"], string> = {
  repository: "Repository",
  branch: "Branch",
  url: "Site",
  files: "Brand files",
};

function HealthIcon({ state }: { state: HealthCheck["state"] }) {
  if (state === "ok") return <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Fine" />;
  if (state === "warning")
    return <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Worth a look" />;
  return <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Broken" />;
}

/**
 * A value that only changes once it has held still for a moment, compared by its JSON.
 *
 * @example const settled = useSettled({ url }, 700);
 */
function useSettled<T>(value: T, delay: number) {
  const json = JSON.stringify(value);
  const [settled, setSettled] = useState(json);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(json), delay);
    return () => clearTimeout(timer);
  }, [json, delay]);

  return JSON.parse(settled) as T;
}
