"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { Check, GitBranch, LoaderCircle, Search } from "lucide-react";
import { cn } from "cn";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import { hasUnsavedChanges } from "@jotdown/editor/client/useLeaveGuard";
import type { Branches } from "@/server/projects/branches";
import { ITEM, note } from "./note";

/** How many branches a menu lists before it offers a filter. */
const FILTER_FROM = 8;

/**
 * The branch the project is read and edited on, and the menu that moves it to another.
 *
 * A GitHub project only changes where the studio looks, and the renderer
 * stays as it is. A folder checks the branch out with git. Writing that is not
 * saved yet holds the switch back, since the page under it would change.
 *
 * @example <BranchMenu projectId="abc123" folder={false} />
 */
export function BranchMenu({ projectId, folder }: { projectId: string; folder: boolean }) {
  const router = useRouter();
  const queries = useQueryClient();
  const [filter, setFilter] = useState("");
  const branches = useQuery({
    queryKey: ["studio", "branches", projectId],
    queryFn: () => fetchJson<Branches>(`/api/projects/${projectId}/branches`, { cache: "no-store" }),
    staleTime: 60_000,
    retry: false,
  });
  const move = useMutation({
    mutationFn: (branch: string) => postJson(`/api/projects/${projectId}/branches`, { branch }),
    onSuccess: async (_answer, branch) => {
      router.refresh();
      await queries.invalidateQueries();
      note(folder ? `Checked out ${branch}` : `Now on ${branch}`);
    },
    onError: (error) => note(error.message, "failed"),
  });

  function choose(branch: string) {
    if (branch === branches.data?.current) return;
    if (hasUnsavedChanges()) return note("Save your changes before you switch branches.", "failed");
    move.mutate(branch);
  }

  if (!branches.data) return null;
  const { current, home, branches: all } = branches.data;
  const shown = all.filter((branch) => branch.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <DropdownMenu.Root onOpenChange={() => setFilter("")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu.Trigger className={cn(ITEM, "min-w-0")} aria-label={`Branch: ${current}`}>
            {move.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <GitBranch className="size-3.5" aria-hidden="true" />
            )}
            <span className="max-w-40 truncate">{move.isPending ? move.variables : current}</span>
          </DropdownMenu.Trigger>
        </TooltipTrigger>
        <TooltipContent side="top">{folder ? "The folder's checked out branch" : "The branch you edit"}</TooltipContent>
      </Tooltip>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 flex max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-64 flex-col rounded-lg bg-popover p-1 text-popover-foreground text-sm shadow-xl ring-1 ring-foreground/10 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          {all.length > FILTER_FROM && (
            <label className="flex items-center gap-2 border-border border-b px-2 pb-1.5 text-muted-foreground">
              <Search className="size-3.5 shrink-0" aria-hidden="true" />
              <input
                // biome-ignore lint/a11y/noAutofocus: the filter is what a long list of branches opens for
                autoFocus
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                onKeyDown={(event) => event.key !== "Escape" && event.stopPropagation()}
                placeholder="Find a branch"
                aria-label="Find a branch"
                spellCheck={false}
                className="h-7 min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
          <div className="min-h-0 overflow-y-auto pt-1">
            {shown.map((branch) => (
              <DropdownMenu.Item
                key={branch}
                onSelect={() => choose(branch)}
                className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
              >
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{branch}</span>
                {branch === home && <span className="text-muted-foreground text-xs">default</span>}
                <Check className={cn("size-3.5 shrink-0", branch !== current && "invisible")} aria-hidden="true" />
              </DropdownMenu.Item>
            ))}
            {shown.length === 0 && <p className="px-2 py-1.5 text-muted-foreground text-xs">No branch matches.</p>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
