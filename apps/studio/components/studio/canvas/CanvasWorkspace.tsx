"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle, TerminalSquare } from "lucide-react";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import { Button } from "@jotdown/core/components/ui/button";
import type { DevServerState } from "@/server/canvas/dev-server";
import { WorkspaceMenu } from "../Workspace";
import { CanvasFrame } from "./CanvasFrame";
import { RendererMenu } from "./RendererMenu";

type Project = { key: string; base: string; title: string; repository?: string };

/**
 * The studio around a project a canvas draws: a slim bar with the project switcher and the renderer, over the canvas.
 *
 * Everything inside the frame, the sidebar, the page and its editing, is the
 * site's own. In the app the bar is the window's title bar, so it sits beside
 * the window's buttons and drags the window. With no address, the canvas is
 * the folder's own dev server, which is started first.
 *
 * @example <CanvasWorkspace src="https://notes.example.com/_edit" project={project} />
 */
export function CanvasWorkspace({ src, project }: { src: string | null; project: Project }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-11 wco:h-(--titlebar-height) shrink-0 items-center gap-2 border-border border-b px-3 wco:ps-[calc(var(--titlebar-start)+0.5rem)] [-webkit-app-region:drag]">
        <div className="flex min-w-0 max-w-64 [-webkit-app-region:no-drag]">
          <WorkspaceMenu />
        </div>
        <div className="flex-1" />
        <RendererMenu />
      </header>
      {src ? <CanvasFrame src={src} project={project} /> : <DevCanvas project={project} />}
    </div>
  );
}

/**
 * The folder's dev server, started and watched, then framed once it serves its canvas.
 *
 * While it starts, the last lines it printed show under a spinner, so a slow
 * first install reads as work rather than a hang. A server that fails says
 * why, with its log, and offers another try or the studio's own drawing.
 */
function DevCanvas({ project }: { project: Project }) {
  const router = useRouter();
  const server = useQuery({
    queryKey: ["canvas", "dev", project.key],
    queryFn: () =>
      fetchJson<DevServerState>(`/api/canvas/dev?${new URLSearchParams({ key: project.key })}`, { cache: "no-store" }),
    refetchInterval: (query) => (query.state.data?.state === "ready" ? 60_000 : 1500),
  });
  const retry = useMutation({
    mutationFn: () => fetchJson(`/api/canvas/dev?${new URLSearchParams({ key: project.key, retry: "1" })}`),
    onSuccess: () => server.refetch(),
  });
  const skinny = useMutation({
    mutationFn: () => postJson("/api/projects/renderer", { key: project.key, renderer: { mode: "skinny" } }),
    onSuccess: () => router.refresh(),
  });

  const status = server.data;
  if (status?.state === "ready") return <CanvasFrame src={status.url} project={project} />;

  const failed = status?.state === "failed" ? status : null;
  const problem = failed?.problem ?? server.error?.message;

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-8">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2.5">
          {problem ? (
            <TerminalSquare className="size-5 text-destructive" aria-hidden="true" />
          ) : (
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          <h2 className="font-medium">
            {problem ? "The site's dev server did not start" : "Starting the site's dev server"}
          </h2>
        </div>
        <p className="mt-1.5 text-muted-foreground text-sm">
          {problem ??
            "The first start installs the site's packages, which takes a minute. After that it is a few seconds."}
        </p>
        {status && status.log.length > 0 && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-muted-foreground text-xs leading-relaxed">
            {status.log.slice(-12).join("\n")}
          </pre>
        )}
        {problem && (
          <div className="mt-5 flex gap-2">
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              Try again
            </Button>
            <Button variant="outline" onClick={() => skinny.mutate()} disabled={skinny.isPending}>
              Open in Skinny
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
