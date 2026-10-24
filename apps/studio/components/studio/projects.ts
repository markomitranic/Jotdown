"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@jotdown/core/lib/fetch-json";
import { hasUnsavedChanges } from "@jotdown/editor/client/useLeaveGuard";
import { parseProjectKey, type ProjectKey } from "@/lib/project-key";
import { rememberAnsweredBookmarks, useAnsweredBookmarks } from "./saved";
import { wearBrand } from "@jotdown/core/lib/wear-brand";
import { confirmInPage } from "@jotdown/core/components/confirm";

/** A project GitHub lists for the editor, as `GET /api/projects` answers, with the address its icon is drawn from. */
export type ProjectListing = { key: string; title: string; description: string; icon: string | null };

/**
 * A favorite: a GitHub project or a folder the studio keeps.
 *
 * A pinned bookmark is always listed and cannot be taken off. A locked bookmark is one GitHub will not show the editor, listed so they know
 * to ask for access, or a folder that is no longer a project. A folder bookmark
 * says where the folder is on this machine, and the GitHub organisation its git
 * `origin` belongs to, when it has one.
 */
export type Bookmark = {
  key: string;
  title: string;
  icon: string | null;
  locked: boolean;
  folder?: string;
  owner?: string;
  /** Always listed, with no way to take it off. */
  pinned?: boolean;
};

/**
 * The favorites, as GitHub and the disk answer for them, and the project last opened.
 *
 * The last answer shows at once from this browser's cache and is replaced when
 * the studio answers again. Saving and removing change the list at once and
 * ask the studio after; removing takes a favorite off without asking again.
 *
 * @example const { bookmarks, recent, error, save, forget } = useBookmarks();
 */
export function useBookmarks() {
  const answeredBefore = useAnsweredBookmarks();
  const queries = useQueryClient();
  const answer = useQuery({ queryKey: BOOKMARKS_QUERY, queryFn: readBookmarks });
  const refresh = () => queries.invalidateQueries({ queryKey: BOOKMARKS_QUERY });

  const forgetting = useMutation({
    mutationFn: (key: string) =>
      fetchJson(`/api/projects/bookmarks?${new URLSearchParams({ key })}`, { method: "DELETE" }),
    onMutate: (key) => change((bookmarks) => bookmarks.filter((bookmark) => bookmark.key !== key)),
    onSettled: refresh,
  });

  const saving = useMutation({
    mutationFn: ({ key, title }: { key: string; title: string }) => keepProject(key, title),
    onMutate: ({ key, title }) =>
      change((bookmarks) =>
        bookmarks.some((bookmark) => bookmark.key === key)
          ? bookmarks
          : [...bookmarks, { key, title, icon: null, locked: false }],
      ),
    onSettled: refresh,
  });

  function change(edit: (bookmarks: Bookmark[]) => Bookmark[]) {
    queries.setQueryData<BookmarksAnswer>(
      BOOKMARKS_QUERY,
      (current) => current && { ...current, bookmarks: edit(current.bookmarks) },
    );
  }

  const answered = answer.data?.bookmarks ?? answeredBefore;
  const unknown = answer.isPending && answered.length === 0;

  return {
    bookmarks: unknown ? null : answered,
    recent: answer.data?.selected ?? null,
    error: answer.error?.message ?? "",
    save: (key: string, title: string) => saving.mutate({ key, title }),
    forget: (key: string) => forgetting.mutate(key),
  };
}

const BOOKMARKS_QUERY = ["projects", "bookmarks"];

type BookmarksAnswer = { bookmarks: Bookmark[]; selected: string | null };

/** The studio's answer for the favorites, kept in this browser for the next page load. */
async function readBookmarks() {
  const answer = await fetchJson<BookmarksAnswer>("/api/projects/bookmarks");
  rememberAnsweredBookmarks(answer.bookmarks);
  return answer;
}

/**
 * Keeps a GitHub project among the favorites.
 *
 * @example await keepProject("grace/talks", "Talks");
 */
function keepProject(key: string, title: string) {
  return postJson("/api/projects/bookmarks", { key, title });
}

/**
 * Every project GitHub lists for the editor, asked of the studio.
 *
 * @example await discoverProjects(); // [{ key: "acme/jotdown", title: "Jotdown", … }]
 */
export async function discoverProjects() {
  return (await fetchJson<{ projects: ProjectListing[] }>("/api/projects")).projects;
}

/** The steps of opening a project, in the order they happen. */
export const OPENING_STEPS = ["reading", "finding", "branding", "downloading", "compiling"] as const;

export type OpeningStep = (typeof OPENING_STEPS)[number];

/** How a project looks: its title and its logo, in both colour modes, at the addresses the studio serves them. */
export type ProjectLook = {
  title: string;
  logo: { alt: string; src: string; srcDark: string } | null;
};

/** A project on its way: the key and title it was asked for, how far it got, and what GitHub said about it. */
export type Opening = {
  key: string;
  title: string | null;
  parts: ProjectKey | null;
  step: OpeningStep;
  found: { branch: string; head: string } | null;
  look: ProjectLook | null;
  problem: string | null;
};

/** What opening answers for a project whose config is broken. */
type Broken = { broken: true; key: string };

/**
 * Opens projects by key, one step at a time, and says which step it is on or why it stopped.
 *
 * The key is read here, GitHub is asked for the branch and commit, the page puts
 * on the project's brand, the commit is downloaded into the studio's scratch
 * folder, and then the page reloads onto the project, which compiles it. The old
 * page stays up until the new one replaces it, so `opening` stays set through the
 * compile. Going back after a failure takes the borrowed brand off again. A
 * project opened as a bookmark is kept among the favorites once GitHub lets
 * the editor read it.
 *
 * The last step is a full page load of `/owner/repo`, never a client-side
 * navigation, because the whole shell around the page belongs to the project.
 * A project whose config is broken goes there at once, to the page that says so.
 *
 * @example const { opening, open, dismiss } = useOpenProject(); open("you/site", "Web docs", true);
 */
export function useOpenProject() {
  const [opening, setOpening] = useState<Opening | null>(null);
  const takeOffBrand = useRef<(() => void) | null>(null);
  const advance = (change: Partial<Opening>) =>
    setOpening((current) => (current ? { ...current, ...change } : current));

  const { mutate: fetchProject } = useMutation({
    mutationFn: async ({ key, bookmark }: { key: string; bookmark: boolean }) => {
      advance({ step: "finding" });
      const found = await postJson<{ key: string; branch: string; head: string } | Broken>("/api/projects", {
        action: "open",
        key,
      });
      if ("broken" in found) return found.key;

      advance({ step: "branding", found: { branch: found.branch, head: found.head } });
      const brand = await postJson<(ProjectLook & { stylesheet: string | null }) | Broken>("/api/projects", {
        action: "brand",
        key: found.key,
      });
      if ("broken" in brand) return found.key;
      takeOffBrand.current = wearBrand(brand.stylesheet);
      if (bookmark) await keepProject(found.key, brand.title);

      advance({ step: "downloading", look: { title: brand.title, logo: brand.logo } });
      await postJson("/api/projects", { action: "download", key: found.key });
      return found.key;
    },
    onSuccess: (key) => {
      advance({ step: "compiling" });
      window.location.assign(`/${key}`);
    },
    onError: (error) => advance({ problem: error.message }),
  });

  async function open(key: string, title: string | null, bookmark: boolean) {
    const switching =
      !hasUnsavedChanges() ||
      (await confirmInPage({
        title: "Switch projects?",
        description: "Your unsaved edits on this page will be lost.",
        confirm: "Switch",
      }));
    if (!switching) return;

    const parts = parseProjectKey(key);
    setOpening({ key, title, parts, step: "reading", found: null, look: null, problem: null });
    if (!parts) return advance({ problem: "Write the project as owner/repo." });

    fetchProject({ key, bookmark });
  }

  function dismiss() {
    takeOffBrand.current?.();
    takeOffBrand.current = null;
    setOpening(null);
  }

  return { opening, open, dismiss };
}
