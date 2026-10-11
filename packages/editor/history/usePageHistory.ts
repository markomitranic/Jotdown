"use client";

import { useState } from "react";
import { skipToken, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchPageHistory, fetchPageRevision, useDocTarget, useLiveEditConfig } from "../client/api";
import type { PageHistoryResponse, PageRevision } from "../types";

/**
 * The page's committed versions, one page at a time, and the one a reader opened.
 *
 * Later pages are pinned to the head page 1 answered with, so a commit landing
 * meanwhile cannot shift the list. The list is read again each time the panel
 * opens, so a save just made is on it. A revision is immutable, so it is read
 * once.
 *
 * @example const { revisions, selected, revision } = usePageHistory();
 */
export function usePageHistory() {
  const { apiBase } = useLiveEditConfig();
  const { path } = useDocTarget();
  const [choice, setChoice] = useState<{ path: string; revision: PageRevision } | null>(null);

  const listing = useInfiniteQuery({
    queryKey: ["history", apiBase, path],
    queryFn: ({ pageParam, signal }) => fetchPageHistory(apiBase, path, pageParam.page, pageParam.head, signal),
    initialPageParam: { page: 1, head: "" },
    staleTime: 0,
    getNextPageParam: (last, pages) =>
      last.nextPage ? { page: last.nextPage, head: pages[0]?.head ?? "" } : undefined,
    select: (data) => ({
      current: data.pages[0]?.current,
      revisions: uniqueBySha(data.pages),
    }),
  });

  const selected = (choice?.path === path ? choice.revision : null) ?? listing.data?.revisions[0] ?? null;

  const revision = useQuery({
    queryKey: ["history", apiBase, path, selected?.sha],
    queryFn: selected ? ({ signal }) => fetchPageRevision(apiBase, path, selected.sha, signal) : skipToken,
    staleTime: Infinity,
  });

  function loadMore() {
    if (listing.isError && !listing.isFetchNextPageError) return void listing.refetch();
    void listing.fetchNextPage();
  }

  return {
    revisions: listing.data?.revisions,
    current: listing.data?.current,
    hasMore: listing.hasNextPage,
    selected,
    select: (revision: PageRevision) => setChoice({ path, revision }),
    revision: revision.data,
    loading: listing.isPending || listing.isFetchingNextPage,
    error: listing.error?.message,
    revisionError: revision.error?.message,
    loadMore,
    retryRevision: () => void revision.refetch(),
  };
}

/**
 * Every page's revisions in order, each commit once.
 *
 * @example uniqueBySha([{ revisions: [a, b] }, { revisions: [b, c] }]); // [a, b, c]
 */
function uniqueBySha(pages: PageHistoryResponse[]) {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.revisions)
    .filter((revision) => {
      if (seen.has(revision.sha)) return false;
      seen.add(revision.sha);
      return true;
    });
}
