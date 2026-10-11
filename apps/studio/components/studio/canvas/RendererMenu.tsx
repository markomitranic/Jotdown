"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { Check, Globe, Laptop, PenLine, Terminal } from "lucide-react";
import { cn } from "cn";
import { postJson } from "@jotdown/core/lib/fetch-json";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";
import type { Renderer } from "@/server/storage/favorites";
import { useWorkspace } from "../Workspace";

const LOOKS = {
  site: { label: "Site", icon: Globe },
  custom: { label: "Custom address", icon: Laptop },
  dev: { label: "Dev server", icon: Terminal },
  skinny: { label: "Skinny", icon: PenLine },
} as const;

/**
 * The switch between the three ways a project is drawn: its site, a canvas at an address of your own, or the studio's own page.
 *
 * Site needs a `url` in the project's config. A folder can also be drawn by its
 * site's dev server, which the studio starts and stops itself, and a custom
 * address is any other canvas, usually a dev server you run. The choice is remembered for the project and
 * never written into it.
 *
 * @example <RendererMenu />
 */
export function RendererMenu({ className }: { className?: string }) {
  const workspace = useWorkspace();
  if (!workspace?.drawing) return null;

  return <RendererChoice projectKey={workspace.project.key} drawing={workspace.drawing} className={className} />;
}

type Drawing = { mode: keyof typeof LOOKS; siteUrl: string | null; customUrl: string | null; folder: boolean };

/**
 * The renderer switch for one project, as it is drawn now.
 *
 * @example <RendererChoice projectKey="local/notes" drawing={{ mode: "dev", siteUrl: null, customUrl: null, folder: true }} />
 */
export function RendererChoice({
  projectKey,
  drawing,
  className,
}: {
  projectKey: string;
  drawing: Drawing;
  className?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const choose = useMutation({
    mutationFn: (renderer: Renderer) => postJson("/api/projects/renderer", { key: projectKey, renderer }),
    onSuccess: () => router.refresh(),
  });

  const { mode, siteUrl, customUrl, folder } = drawing;
  const Current = LOOKS[mode].icon;

  return (
    <DropdownMenu.Root onOpenChange={() => setAsking(false)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu.Trigger
            aria-label={`Drawn by: ${LOOKS[mode].label}`}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-muted-foreground text-xs outline-none transition-colors [-webkit-app-region:no-drag] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
              className,
            )}
          >
            <Current className="size-3.5" aria-hidden="true" />
            {LOOKS[mode].label}
          </DropdownMenu.Trigger>
        </TooltipTrigger>
        <TooltipContent side="top">How this project is drawn</TooltipContent>
      </Tooltip>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-lg bg-popover p-1 text-popover-foreground text-sm shadow-xl ring-1 ring-foreground/10 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">
            Draw this project with
          </DropdownMenu.Label>
          <Choice
            mode="site"
            current={mode}
            detail={siteUrl ? siteUrl.replace(/^https?:\/\//, "") : "Name the site's url in the config first"}
            disabled={!siteUrl}
            onSelect={() => choose.mutate({ mode: "site" })}
          />
          {folder && (
            <Choice
              mode="dev"
              current={mode}
              detail="The site's own dev server, started and stopped for you"
              onSelect={() => choose.mutate({ mode: "dev" })}
            />
          )}
          <Choice
            mode="custom"
            current={mode}
            detail={customUrl ?? "A dev server on this machine, say"}
            onSelect={(event) => {
              event.preventDefault();
              setAsking(true);
            }}
          />
          {asking && (
            <CustomAddress
              start={customUrl ?? "http://localhost:6193/_edit"}
              onChoose={(url) => choose.mutate({ mode: "custom", url })}
            />
          )}
          <Choice
            mode="skinny"
            current={mode}
            detail="The studio draws the page in the default look"
            onSelect={() => choose.mutate({ mode: "skinny" })}
          />
          {choose.error && <p className="px-2.5 py-1.5 text-destructive text-xs">{choose.error.message}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type ChoiceProps = {
  mode: keyof typeof LOOKS;
  current: keyof typeof LOOKS;
  detail: string;
  disabled?: boolean;
  onSelect: (event: Event) => void;
};

function Choice({ mode, current, detail, disabled, onSelect }: ChoiceProps) {
  const Icon = LOOKS[mode].icon;

  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-default items-start gap-2.5 rounded-md px-2.5 py-2 outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{LOOKS[mode].label}</span>
        <span className="block truncate text-muted-foreground text-xs">{detail}</span>
      </span>
      <Check className={cn("mt-0.5 size-3.5 shrink-0", mode !== current && "invisible")} aria-hidden="true" />
    </DropdownMenu.Item>
  );
}

/** The address field a custom canvas is typed into. */
function CustomAddress({ start, onChoose }: { start: string; onChoose: (url: string) => void }) {
  const [url, setUrl] = useState(start);
  const valid = URL.canParse(url) && /^https?:/.test(url);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onChoose(url);
  }

  return (
    <form onSubmit={submit} className="flex gap-1.5 px-2.5 pb-2">
      <input
        // biome-ignore lint/a11y/noAutofocus: the field opens because the reader asked to type an address
        autoFocus
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label="Canvas address"
        spellCheck={false}
        className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={!valid}
        className="h-7 rounded-md bg-primary px-2.5 font-medium text-primary-foreground text-xs disabled:opacity-50"
      >
        Use
      </button>
    </form>
  );
}
