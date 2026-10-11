"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { drawIcon } from "../setup/icon";
import { useDraft } from "./draft";
import { withValue } from "@/lib/settings/config-draft";
import { TextSetting } from "./GeneralSection";
import { SettingsGroup, SettingsRow } from "./parts";
import { fittedPng, uploadBrandFile } from "./upload";

/**
 * The project's marks: a square icon for every square slot, and an optional wide wordmark.
 *
 * The icon is drawn into a 512-pixel square before it is uploaded, so whatever
 * is chosen arrives as the shape every slot expects, and each slot is drawn
 * beside it. A file uploaded here shows from the browser's own copy until the
 * draft is saved, since the project serves it only after that.
 *
 * @example <IdentitySection />
 */
export function IdentitySection() {
  const { config, base, update, projectId } = useDraft();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const title = config?.title || "Documentation";

  const shown = (src: string | undefined) => src && (previews[src] ?? `${base}${src}`);
  const icon = shown(config?.favicon ?? config?.logo?.src);

  async function uploadIcon(file: File) {
    const drawn = await drawIcon(file);
    const bytes = Uint8Array.from(atob(drawn.base64), (char) => char.charCodeAt(0));
    const { url } = await uploadBrandFile(projectId, new Blob([bytes], { type: "image/png" }), "image", "the icon");
    setPreviews((known) => ({ ...known, [url]: drawn.preview }));
    update((current) => withValue(current, "favicon", url));
  }

  function uploadLogo(variant: "src" | "srcDark") {
    return async (file: File) => {
      const drawn = await fittedPng(file, 1600, 400);
      const { url } = await uploadBrandFile(projectId, drawn.blob, "image", "the logo");
      setPreviews((known) => ({ ...known, [url]: drawn.preview }));
      update((current) =>
        withValue(current, "logo", { alt: current.logo?.alt ?? current.title ?? "", ...current.logo, [variant]: url }),
      );
    };
  }

  return (
    <>
      <SettingsGroup title="Icon">
        <SettingsRow
          label="Icon"
          description="A square mark for the browser tab, the sidebar, the switcher and the app. Anything you choose is fitted into a square."
          paths={["favicon"]}
          keywords="favicon logo square mark"
          stacked
        >
          <div className="flex w-full flex-wrap items-center gap-5">
            <ImageDrop
              label="the icon"
              src={shown(config?.favicon)}
              square
              onFile={uploadIcon}
              onRemove={() => update((current) => withValue(current, "favicon", undefined))}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
              <Slot label="Sidebar">
                <span className="flex h-9 items-center gap-2 rounded-md bg-sidebar px-2.5 ring-1 ring-border">
                  <Mark src={icon} title={title} className="size-5" />
                  <span className="max-w-32 truncate font-medium text-[0.8125rem]">{title}</span>
                </span>
              </Slot>
              <Slot label="Browser tab">
                <span className="flex h-9 w-44 items-center gap-2 rounded-t-lg bg-muted px-3">
                  <Mark src={icon} title={title} className="size-4" />
                  <span className="truncate text-xs">{title}</span>
                  <X className="ms-auto size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                </span>
              </Slot>
              <Slot label="Dock">
                <span className="grid size-12 place-items-center rounded-[22%] bg-background shadow-sm ring-1 ring-border">
                  <Mark src={icon} title={title} className="size-9" />
                </span>
              </Slot>
            </div>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Wordmark">
        <SettingsRow
          label="Logo"
          description="An optional wide logo with the name in it, for places that fit one. Where a square is needed and there is no icon, it is fitted in."
          paths={["logo.src"]}
          keywords="logo wordmark brand"
          stacked
        >
          <div className="flex flex-wrap gap-4">
            <LabelledDrop label="Light">
              <ImageDrop
                label="the logo"
                src={shown(config?.logo?.src)}
                onFile={uploadLogo("src")}
                onRemove={() => update((current) => withValue(current, "logo", undefined))}
              />
            </LabelledDrop>
            <LabelledDrop label="Dark">
              <ImageDrop
                label="the dark logo"
                src={shown(config?.logo?.srcDark)}
                dark
                disabled={!config?.logo?.src}
                onFile={uploadLogo("srcDark")}
                onRemove={() => update((current) => withValue(current, "logo.srcDark", undefined))}
              />
            </LabelledDrop>
          </div>
        </SettingsRow>
        {config?.logo && (
          <SettingsRow label="Alt text" description="What a screen reader says for the logo." paths={["logo.alt"]}>
            <TextSetting path="logo.alt" placeholder={title} className="w-64" />
          </SettingsRow>
        )}
      </SettingsGroup>
    </>
  );
}

/** One slot the icon fills, drawn small, with its name under it. */
function Slot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      {children}
      <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
    </span>
  );
}

function LabelledDrop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

/** The icon fitted into its square, or the title's initial in the primary when there is none. */
function Mark({ src, title, className }: { src: string | undefined; title: string; className: string }) {
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center rounded bg-primary font-semibold text-[0.625rem] text-primary-foreground",
          className,
        )}
      >
        {title.charAt(0).toUpperCase()}
      </span>
    );
  }
  // biome-ignore lint/performance/noImgElement: a preview of a file that may only exist in this browser
  return <img src={src} alt="" className={cn("shrink-0 object-contain", className)} />;
}

type DropProps = {
  label: string;
  src: string | undefined;
  square?: boolean;
  dark?: boolean;
  disabled?: boolean;
  onFile: (file: File) => Promise<void>;
  onRemove: () => void;
};

/**
 * A tile that takes an image dropped on it or chosen, shows it, and takes it away.
 *
 * @example <ImageDrop label="the icon" src={icon} square onFile={upload} onRemove={remove} />
 */
function ImageDrop({ label, src, square, dark, disabled, onFile, onRemove }: DropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const upload = useMutation({ mutationFn: onFile });

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || upload.isPending}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          aria-label={src ? `Replace ${label}` : `Choose ${label}`}
          className={cn(
            "relative grid place-items-center overflow-hidden rounded-xl border border-border border-dashed outline-none transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            square ? "size-24" : "h-20 w-56",
            dark
              ? "bg-[#0b0b0f]"
              : "bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--background)_0_50%)] bg-size-[12px_12px]",
            src && "border-solid",
            over && "border-primary bg-primary/5",
          )}
        >
          {src ? (
            // biome-ignore lint/performance/noImgElement: a preview of a file that may only exist in this browser
            <img src={src} alt="" className="absolute inset-0 size-full object-contain p-2.5" />
          ) : (
            <span
              className={cn(
                "flex flex-col items-center gap-1 text-xs",
                dark ? "text-white/60" : "text-muted-foreground",
              )}
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              Drop or choose
            </span>
          )}
          {upload.isPending && (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            </span>
          )}
        </button>
        {src && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {upload.error && <p className="max-w-56 text-destructive text-xs">{upload.error.message}</p>}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload.mutate(file);
        }}
      />
    </div>
  );
}
