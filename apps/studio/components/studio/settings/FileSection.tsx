"use client";

import { CircleAlert } from "lucide-react";
import { Textarea } from "@jotdown/core/components/ui/textarea";
import { useDraft } from "./draft";
import { SettingsBlock, SettingsGroup } from "./parts";

/**
 * The config file itself, for anything the form does not cover.
 *
 * It edits the same draft the form does, so a key typed here shows in its
 * field, and a field changed there rewrites the text. Text that does not read
 * yet stays as typed, and the form waits until it does.
 *
 * @example <FileSection />
 */
export function FileSection() {
  const { text, setText, syntax, issues } = useDraft();
  const problems = syntax ? [syntax] : [...issues].map(([path, message]) => (path ? `${path}: ${message}` : message));

  return (
    <SettingsGroup title=".jotdown/config.json">
      <SettingsBlock keywords="config file json raw source">
        <Textarea
          aria-label="The config file"
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          className="field-sizing-content min-h-96 resize-none rounded-none border-0 bg-transparent px-4 py-3.5 font-mono text-[0.8125rem] leading-relaxed focus-visible:ring-0 dark:bg-transparent"
        />
        {problems.length > 0 && (
          <ul className="flex flex-col gap-1 border-border border-t bg-destructive/5 px-4 py-3 text-destructive text-xs">
            {problems.map((problem) => (
              <li key={problem} className="flex items-start gap-2">
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono">{problem}</span>
              </li>
            ))}
          </ul>
        )}
      </SettingsBlock>
    </SettingsGroup>
  );
}
