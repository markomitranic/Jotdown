"use client";

import { useMemo } from "react";
import { compareMarkdown } from "./diff";

/** Shows current-to-historical line changes, with raw text when comparison is too expensive. */
export function RevisionDiff({ current, selected }: { current: string; selected: string }) {
  const diff = useMemo(() => compareMarkdown(current, selected), [current, selected]);
  if (!diff)
    return (
      <div className="space-y-4 p-4">
        <p>This change is too large to compare here. Both versions are shown below.</p>
        <h3 className="font-medium">Current saved source</h3>
        <pre className="whitespace-pre-wrap break-words text-xs">{current}</pre>
        <h3 className="font-medium">Selected version</h3>
        <pre className="whitespace-pre-wrap break-words text-xs">{selected}</pre>
      </div>
    );
  return (
    <div>
      <p className="sticky top-0 border-b bg-popover p-3 text-xs" role="status">
        {diff.added} added, {diff.removed} removed compared with current saved source
        {current !== selected && diff.added === 0 && diff.removed === 0 && ". Only line endings differ."}
      </p>
      <table
        className="w-full table-fixed border-collapse font-mono text-xs"
        aria-label="Changes from current saved source to selected version"
      >
        <thead className="sr-only">
          <tr>
            <th>Current line</th>
            <th>Selected line</th>
            <th>Change</th>
            <th>Markdown</th>
          </tr>
        </thead>
        <colgroup>
          <col className="w-10" />
          <col className="w-10" />
          <col className="w-6" />
          <col />
        </colgroup>
        <tbody>
          {diff.rows.map((row, index) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: diff rows are recomputed whole and never reorder
              key={index}
              className={row.kind === "added" ? "bg-green-500/10" : row.kind === "removed" ? "bg-red-500/10" : ""}
            >
              <td className="select-none px-1 text-right align-top text-muted-foreground">{row.before}</td>
              <td className="select-none px-1 text-right align-top text-muted-foreground">{row.after}</td>
              <td className="text-center align-top">
                <span aria-hidden="true">{row.kind === "added" ? "+" : row.kind === "removed" ? "−" : " "}</span>
                <span className="sr-only">{row.kind === "same" ? "Unchanged" : row.kind}</span>
              </td>
              <td className="whitespace-pre-wrap break-words pr-3">{row.text || "\u00a0"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
