"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { GitHubMark } from "@jotdown/core/components/brand-icons";
import { Button } from "@jotdown/core/components/ui/button";
import { Input } from "@jotdown/core/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@jotdown/core/components/ui/field";
import { fetchSource, saveSource, useLiveEditConfig } from "@jotdown/editor/client/api";
import { prefillFields, repairFrontmatter, type FrontmatterFields } from "./repair";

type Props = {
  /** The page's file, `docs/guides/setup.mdx`. */
  path: string;
  /** The file as the page was rendered from, to fill the fields in. */
  text: string;
  /** The file on GitHub, or empty for a folder on this machine. */
  githubUrl: string;
};

/**
 * The front matter fields of a page that cannot open, filled in with whatever could still be read, and Save.
 *
 * Saving rewrites only the front matter, on top of the file as it is on the
 * branch right now, and redraws the page. Fields the form does not show are
 * kept when they read, and named before saving when they have to go.
 *
 * @example <FrontmatterForm path="docs/setup.mdx" text={raw} githubUrl="https://github.com/…" />
 */
export function FrontmatterForm({ path, text, githubUrl }: Props) {
  const { apiBase, identity } = useLiveEditConfig();
  const router = useRouter();
  const [fields, setFields] = useState(() => prefillFields(text));
  const [redrawing, redraw] = useTransition();
  const { dropped } = repairFrontmatter(text, fields);
  const field = (key: keyof FrontmatterFields) => ({
    value: fields[key],
    onChange: (event: { target: { value: string } }) => setFields({ ...fields, [key]: event.target.value }),
  });

  const saving = useMutation({
    mutationFn: async () => {
      if (!identity) throw new Error("Sign in to fix this page.");
      const head = await fetchSource(apiBase, path);
      return saveSource(apiBase, {
        path,
        text: repairFrontmatter(head.text, fields).text,
        sha: head.sha,
        message: `docs: fix the front matter of ${fields.title.trim()}\n\nFixed in Jotdown.`,
        author: identity,
      });
    },
    onSuccess: () => redraw(() => router.refresh()),
  });
  const busy = saving.isPending || redrawing;

  return (
    <form
      className="mt-8 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        saving.mutate();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="broken-title">Title</FieldLabel>
          <Input
            id="broken-title"
            className="h-10"
            required
            autoFocus={!fields.title}
            disabled={busy}
            {...field("title")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="broken-description">
            Description
            <span className="font-normal text-muted-foreground">Optional</span>
          </FieldLabel>
          <Input id="broken-description" className="h-10" disabled={busy} {...field("description")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="broken-icon">
            Icon
            <span className="font-normal text-muted-foreground">Optional</span>
          </FieldLabel>
          <Input
            id="broken-icon"
            className="h-10 font-mono"
            placeholder="BookOpen"
            disabled={busy}
            {...field("icon")}
          />
          <FieldDescription>A Lucide icon name.</FieldDescription>
        </Field>
      </FieldGroup>

      {dropped.length > 0 && (
        <p className="mt-5 text-muted-foreground text-sm">
          Saving removes{" "}
          {dropped.map((key, index) => (
            <span key={key}>
              {index > 0 && ", "}
              <code>{key}</code>
            </span>
          ))}
          , which cannot be kept as written.
        </p>
      )}
      <FieldError className="mt-5">{saving.error?.message}</FieldError>

      <div className="mt-6 flex items-center gap-2">
        <Button type="submit" size="lg" disabled={busy || !fields.title.trim() || !identity}>
          {busy ? "Saving…" : "Save and open"}
        </Button>
        {githubUrl && (
          <Button variant="outline" size="lg" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              <GitHubMark />
              Open in GitHub
            </a>
          </Button>
        )}
      </div>
    </form>
  );
}
