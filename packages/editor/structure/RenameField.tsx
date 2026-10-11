"use client";

import { useRef, useState } from "react";

type Props = {
  value: string;
  placeholder?: string;
  onConfirm(next: string): void;
  onCancel(): void;
};

/**
 * A sidebar row's label, turned into something you can type over.
 *
 * Set in the row's own type and at the row's own height, so the name you are
 * typing sits exactly where it will be drawn. Enter confirms and Escape
 * cancels. Clicking away confirms too, which is what somebody who just finished
 * typing a name means by clicking away.
 *
 * @example <RenameField value="Architecture" onConfirm={rename} onCancel={stop} />
 */
export default function RenameField({ value, placeholder, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState(value);
  const settled = useRef(false);

  const finish = (next: string | null) => {
    if (settled.current) return;
    settled.current = true;

    const name = next?.trim();
    if (name && name !== value) onConfirm(name);
    else onCancel();
  };

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the field appears because the reader asked to rename, so typing goes straight into it
      autoFocus
      className="-my-0.5 -ms-1 h-6 min-w-0 flex-1 rounded-md bg-background px-1 text-foreground shadow-xs outline-none ring-1 ring-primary/60 placeholder:text-muted-foreground/70"
      value={typed}
      placeholder={placeholder}
      aria-label={value ? `Rename ${value}` : (placeholder ?? "Name")}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={() => finish(typed)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(typed);
        if (event.key === "Escape") finish(null);
      }}
    />
  );
}
