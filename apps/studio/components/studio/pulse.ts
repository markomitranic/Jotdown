"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import { getQueryClient } from "@jotdown/core/lib/query-client";
import { useWorkspace } from "./Workspace";

type Pulse = { version: string };

/** How often a page asks: once a minute, every ten seconds for a folder on this machine, which costs nothing to ask. */
const POLL_MS = 60_000;
const FOLDER_POLL_MS = 10_000;

/** How long a page goes untouched before it stops asking until it is used or focused again. */
const IDLE_MS = 5 * 60_000;
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "focus"] as const;

let lastActive = Date.now();

if (typeof window !== "undefined") {
  for (const event of ACTIVITY) window.addEventListener(event, markActive, { passive: true });
}

/**
 * The studio's one poll: the open project's branch head, or the folder's fingerprint.
 *
 * It asks while the tab is visible and in use, stops after five untouched
 * minutes, and asks again the moment the window is focused or used. Nothing is
 * asked with no project open.
 *
 * @example const pulse = useStudioPulse(); pulse.data?.version;
 */
export function useStudioPulse() {
  const project = useWorkspace()?.project;
  const local = project?.key.startsWith("local/");

  return useQuery({
    queryKey: ["studio", "pulse", project?.id ?? null],
    queryFn: () => fetchJson<Pulse>(`/api/projects/${project?.id}/version`, { cache: "no-store" }),
    enabled: project !== undefined,
    refetchInterval: () => (asleep() ? false : local ? FOLDER_POLL_MS : POLL_MS),
    staleTime: 0,
    retry: false,
  });
}

function asleep() {
  return Date.now() - lastActive > IDLE_MS;
}

function markActive() {
  const woke = asleep();
  lastActive = Date.now();
  if (woke) void getQueryClient().refetchQueries({ queryKey: ["studio", "pulse"], type: "active" });
}
