"use client";

/** Keeps the sidebar available when a page cannot be rendered. */
export default function PageError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="font-semibold text-2xl">This page could not be opened</h1>
      <button type="button" className="rounded border border-border px-4 py-2" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
