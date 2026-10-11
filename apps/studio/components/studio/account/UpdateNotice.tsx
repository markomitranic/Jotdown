"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { cn } from "cn";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import type { Update } from "@/server/updates";

/**
 * The downloaded Jotdown update waiting for a restart, asked of the app every minute, and the restart that installs it.
 *
 * @example const { update, restart, restarting } = useUpdate(); // update: { version: "0.3.2" }
 */
export function useUpdate() {
  const { data } = useQuery({
    queryKey: ["update"],
    queryFn: () => fetchJson<{ update: Update | null }>("/api/update"),
    refetchInterval: 60_000,
  });
  const restarting = useMutation({ mutationFn: () => postJson("/api/update", {}) });

  return {
    update: data?.update ?? null,
    restart: () => restarting.mutate(),
    restarting: restarting.isPending || restarting.isSuccess,
  };
}

/**
 * A button that restarts the app into a downloaded update, shown only when one is waiting.
 *
 * @example <UpdateNotice className="text-white/75 hover:bg-white/10" />
 */
export function UpdateNotice({ className }: { className?: string }) {
  const { update, restart, restarting } = useUpdate();
  if (!update) return null;

  return (
    <button
      type="button"
      onClick={restart}
      disabled={restarting}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 outline-none transition-colors [-webkit-app-region:no-drag] focus-visible:ring-2 disabled:opacity-70",
        className,
      )}
    >
      <RotateCw className={cn("size-3.5", restarting && "animate-spin")} aria-hidden="true" />
      {restarting ? "Restarting…" : `Restart to update to ${update.version}`}
    </button>
  );
}
