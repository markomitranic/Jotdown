"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ReadOnlyPage, useInplace, useRecovery } from "./context";

const DraftArticle = dynamic(() => import("./DraftArticle"), {
  ssr: false,
  loading: () => <p role="status">Loading draft…</p>,
});

/** Shows a whole-page draft through the block editors, with the deployed page for comparison. */
export function PageDraft({ children }: { children: ReactNode }) {
  const page = useInplace();
  const recovery = useRecovery();
  if (!page || page.draft.replacement() === null) return children;
  return (
    <>
      <div hidden={recovery.current}>
        <DraftArticle key={page.draft.revision()} />
      </div>
      {recovery.current && <ReadOnlyPage>{children}</ReadOnlyPage>}
    </>
  );
}
