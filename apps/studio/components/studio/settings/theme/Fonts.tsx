"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronsUpDown, LoaderCircle, Search, Upload } from "lucide-react";
import { Popover } from "radix-ui";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import type { Theme } from "@jotdown/core/lib/theme";
import type { GoogleFont } from "@/server/settings/fonts";
import { useDraft } from "../draft";
import { withValue } from "@/lib/settings/config-draft";
import { SettingsGroup, SettingsRow } from "../parts";
import { uploadBrandFile } from "../upload";

type Role = "sans" | "serif" | "mono";
type Face = NonNullable<NonNullable<Theme["fonts"]>[Role]>;

const ROLES: { role: Role; label: string; description: string; fallback: string; sample: string }[] = [
  {
    role: "sans",
    label: "Body",
    description: "The article, the sidebar and every label.",
    fallback: "Inter",
    sample: "Every page reads in this face, from the first heading to the last footnote.",
  },
  {
    role: "serif",
    label: "Display",
    description: "The few display titles that ask for a serif.",
    fallback: "System serif",
    sample: "A quiet title in a serif",
  },
  {
    role: "mono",
    label: "Code",
    description: "Code blocks, inline code and file paths.",
    fallback: "JetBrains Mono",
    sample: "const site = await jotdown.publish({ branch: 'main' }); // 0O 1lI",
  },
];

/**
 * The project's three typefaces, each from Google Fonts or a file of its own, with a line set in it.
 *
 * A Google family is downloaded into the project's uploads when it is chosen,
 * so a publication serves it itself. The preview asks Google for the family
 * directly, so it shows before the copy is saved.
 *
 * @example <Fonts />
 */
export function Fonts() {
  return (
    <SettingsGroup title="Typography">
      {ROLES.map((entry) => (
        <FontRow key={entry.role} {...entry} />
      ))}
    </SettingsGroup>
  );
}

function FontRow({ role, label, description, fallback, sample }: (typeof ROLES)[number]) {
  const { config, update, projectId } = useDraft();
  const face = config?.theme?.fonts?.[role];
  const path = `theme.fonts.${role}`;
  useGoogleStylesheet(face?.family);

  return (
    <SettingsRow label={label} description={description} paths={[path]} keywords={`font typeface ${role}`} stacked>
      <div className="flex w-full flex-col gap-3">
        <FontPicker
          projectId={projectId}
          face={face}
          fallback={fallback}
          onChoose={(chosen) => update((current) => withValue(current, path, chosen))}
        />
        <p
          className={cn(
            "truncate rounded-lg bg-background px-3 py-2.5 ring-1 ring-border",
            role === "mono"
              ? "font-mono text-[0.8125rem]"
              : role === "serif"
                ? "font-serif text-xl"
                : "text-[0.9375rem]",
          )}
          style={face ? { fontFamily: `"${face.family}", var(--font-${role})` } : undefined}
        >
          {sample}
        </p>
      </div>
    </SettingsRow>
  );
}

type PickerProps = {
  projectId: string;
  face: Face | undefined;
  fallback: string;
  onChoose: (face: Face | undefined) => void;
};

/** A searchable list of Google families, a way to upload a file instead, and a way back to the default. */
function FontPicker({ projectId, face, fallback, onChoose }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  const fonts = useQuery({
    queryKey: ["settings", "fonts"],
    queryFn: () => fetchJson<GoogleFont[]>(`/api/projects/${projectId}/settings/fonts`),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const install = useMutation({
    mutationFn: (family: string) => postJson<Face>(`/api/projects/${projectId}/settings/font`, { family }),
    onSuccess: (installed) => onChoose(installed),
  });

  const upload = useMutation({
    mutationFn: async (chosen: File) => {
      const { url } = await uploadBrandFile(projectId, chosen, "font", "a font");
      return { family: familyFromFile(chosen.name), src: url };
    },
    onSuccess: (uploaded) => onChoose(uploaded),
  });

  const needle = query.trim().toLowerCase();
  const matches = (fonts.data ?? []).filter((font) => font.family.toLowerCase().includes(needle)).slice(0, 60);
  const busy = install.isPending || upload.isPending;
  const problem = install.error?.message ?? upload.error?.message;

  function choose(font: GoogleFont) {
    setOpen(false);
    install.mutate(font.family);
  }

  function move(event: KeyboardEvent) {
    if (event.key === "ArrowDown") setActive((at) => Math.min(at + 1, matches.length - 1));
    else if (event.key === "ArrowUp") setActive((at) => Math.max(at - 1, 0));
    else if (event.key === "Enter" && matches[active]) choose(matches[active]);
    else return;
    event.preventDefault();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={busy}
          className="flex h-8 min-w-56 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-start text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 data-[state=open]:bg-muted"
        >
          {busy && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
          <span className={cn("truncate", !face && "text-muted-foreground")}>
            {busy ? "Copying into the project…" : (face?.family ?? `${fallback}, the default`)}
          </span>
          <ChevronsUpDown className="ms-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 flex w-80 origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground text-sm shadow-lg data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in"
          >
            <label className="flex items-center gap-2 border-border border-b px-3">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                // biome-ignore lint/a11y/noAutofocus: the picker opens to be typed into
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={move}
                placeholder="Search Google Fonts"
                aria-label="Search Google Fonts"
                className="h-10 w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div role="listbox" aria-label="Google Fonts" className="jd-scroll-container max-h-72 overflow-y-auto p-1">
              {fonts.isPending && (
                <p className="px-2 py-6 text-center text-muted-foreground text-xs">Asking Google Fonts…</p>
              )}
              {fonts.isError && <p className="px-2 py-6 text-center text-destructive text-xs">{fonts.error.message}</p>}
              {fonts.isSuccess && matches.length === 0 && (
                <p className="px-2 py-6 text-center text-muted-foreground text-xs">No family called that.</p>
              )}
              {matches.map((font, index) => (
                <button
                  key={font.family}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(font)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <span className="truncate">{font.family}</span>
                  <span className="ms-auto shrink-0 text-muted-foreground text-xs">
                    {font.category}
                    {font.weights && " · variable"}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 border-border border-t p-1">
              <button
                type="button"
                onClick={() => file.current?.click()}
                className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-start outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <Upload className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Upload a font file
              </button>
              {face && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onChoose(undefined);
                  }}
                  className="rounded-md px-2 py-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
                >
                  Use the default
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        ref={file}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (!chosen) return;
          setOpen(false);
          upload.mutate(chosen);
        }}
      />
      {face?.src && <span className="truncate font-mono text-muted-foreground text-xs">{face.src}</span>}
      {problem && <span className="text-destructive text-xs">{problem}</span>}
    </div>
  );
}

/**
 * Loads a family's stylesheet from Google, so its preview draws before the project's own copy is served.
 *
 * A family Google does not have answers with an error the browser ignores.
 *
 * @example useGoogleStylesheet("Geist");
 */
function useGoogleStylesheet(family: string | undefined) {
  useEffect(() => {
    if (!family) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
    document.head.append(link);
    return () => link.remove();
  }, [family]);
}

/**
 * A family name from a font file's name, in the words the theme's schema allows.
 *
 * @example familyFromFile("Söhne-Buch.woff2"); // "S hne Buch"
 */
function familyFromFile(name: string) {
  const words = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9 _-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .trim();
  return words || "Custom";
}
