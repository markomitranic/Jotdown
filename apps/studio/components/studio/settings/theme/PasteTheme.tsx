"use client";

import { useMemo, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@jotdown/core/components/ui/dialog";
import { Textarea } from "@jotdown/core/components/ui/textarea";
import { parsePastedTheme } from "@/lib/settings/paste";
import { useDraft } from "../draft";

/**
 * A dialog that takes a shadcn theme's CSS and applies it over the draft.
 *
 * The paste is read as it is typed, so the dialog says what it found before
 * anything changes. Applying replaces the colours of each mode the paste sets
 * and takes its radius and fonts, keeping the section accents.
 *
 * @example <PasteTheme />
 */
export function PasteTheme() {
  const { update } = useDraft();
  const [open, setOpen] = useState(false);
  const [css, setCss] = useState("");
  const pasted = useMemo(() => parsePastedTheme(css), [css]);

  function apply() {
    if (!pasted) return;
    const { light, dark, radius, fonts } = pasted.theme;
    update((current) => ({
      ...current,
      theme: {
        ...current.theme,
        ...(light && { light }),
        ...(dark && { dark }),
        ...(radius && { radius }),
        ...(fonts && { fonts: { ...current.theme?.fonts, ...fonts } }),
      },
    }));
    setOpen(false);
    setCss("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPaste aria-hidden="true" />
          Paste a theme
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste a shadcn theme</DialogTitle>
          <DialogDescription>
            Copy the CSS variables from{" "}
            <a href="https://tweakcn.com" target="_blank" rel="noreferrer">
              tweakcn
            </a>{" "}
            or{" "}
            <a href="https://ui.shadcn.com/themes" target="_blank" rel="noreferrer">
              shadcn/ui themes
            </a>
            , with their <code className="font-mono text-xs">:root</code> and{" "}
            <code className="font-mono text-xs">.dark</code> blocks.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          aria-label="Theme CSS"
          value={css}
          onChange={(event) => setCss(event.target.value)}
          placeholder={
            ":root {\n  --background: oklch(1 0 0);\n  --primary: oklch(0.205 0 0);\n}\n.dark {\n  --primary: oklch(0.922 0 0);\n}"
          }
          spellCheck={false}
          className="h-64 resize-none font-mono text-xs leading-relaxed"
        />

        <Found css={css} pasted={pasted} />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!pasted} onClick={apply}>
            Apply to the draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the paste turned into: its swatches, and what it left out. */
function Found({ css, pasted }: { css: string; pasted: ReturnType<typeof parsePastedTheme> }) {
  if (!css.trim()) return <p className="min-h-9 text-muted-foreground text-xs">Nothing pasted yet.</p>;
  if (!pasted)
    return <p className="min-h-9 text-destructive text-xs">No shadcn variables in this, so nothing to apply.</p>;

  const { light = {}, dark = {}, radius, fonts } = pasted.theme;
  const extras = [radius && `radius ${radius}`, ...Object.values(fonts ?? {}).map((font) => font.family)].filter(
    Boolean,
  );

  return (
    <div className="flex min-h-9 flex-col gap-2 text-xs">
      <div className="flex items-center gap-3">
        <Swatches label="Light" colours={Object.values(light)} />
        <Swatches label="Dark" colours={Object.values(dark)} />
      </div>
      <p className="text-muted-foreground">
        {pasted.applied} settings found{extras.length > 0 && `, including ${extras.join(", ")}`}.
        {pasted.skipped.length === 1 && " One variable Jotdown has no use for is left out."}
        {pasted.skipped.length > 1 && ` ${pasted.skipped.length} variables Jotdown has no use for are left out.`}
      </p>
    </div>
  );
}

function Swatches({ label, colours }: { label: string; colours: string[] }) {
  if (colours.length === 0) return null;

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex -space-x-1">
        {colours.slice(0, 12).map((colour, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: two tokens may share a colour, and the order never changes
            key={index}
            className="size-3.5 rounded-full ring-2 ring-popover"
            style={{ background: colour }}
          />
        ))}
      </span>
    </span>
  );
}
