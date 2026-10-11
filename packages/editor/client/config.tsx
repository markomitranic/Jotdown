"use client";

/**
 * The two things the browser half of the editor is told rather than works out.
 *
 * Both are computed on the server and handed down as context: what this deploy
 * is and whether editing is offered at all, which is the same for every page,
 * and which file the page on screen came from, which is not. Nothing here
 * fetches or remembers anything, so a component may read either at any depth.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { LiveEditGlobalData } from "../types";

/** Everything `lib/live-edit/config.ts` publishes, plus where the site is served. */
export type LiveEditConfig = LiveEditGlobalData & { baseUrl: string };

const ConfigContext = createContext<LiveEditConfig | null>(null);

/** Puts the server-computed editing config in reach of the whole client tree. */
export function LiveEditConfigProvider({ config, children }: { config: LiveEditGlobalData; children: ReactNode }) {
  const value = useMemo(() => ({ ...config, baseUrl: "/" }), [config]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** Repo coordinates, the API prefix and the docs index, published by the server. */
export function useLiveEditConfig(): LiveEditConfig {
  const config = useContext(ConfigContext);

  if (config === null) {
    throw new Error("useLiveEditConfig() needs a <LiveEditRoot> above it.");
  }

  return config;
}

/** The page on screen as the editing endpoints see it. */
export type DocTarget = {
  /** Whether code owns this page and browser editing is disabled. */
  generated?: boolean;
  /** Repo-relative, `docs/architecture/index.mdx`. */
  path: string;
  /** Where the file sits from the repository root, with the project's content folder in front of `path`. */
  localPath: string;
  title: string;
  /** Where the page is served as its own markdown source. */
  markdownUrl: string;
  /** The page's `.mdx` file on GitHub. */
  githubUrl: string;
  /** Where readers open the page on the publication, empty when the project names no `publicUrl`. */
  publicUrl: string;
};

const TargetContext = createContext<DocTarget | null>(null);

/**
 * Names the file the article was rendered from.
 *
 * The page is a server component, so nothing in the browser can work this out
 * from the URL alone: a page may claim any address through its frontmatter.
 * The route hands it down instead.
 */
export function DocTargetProvider({ target, children }: { target: DocTarget; children: ReactNode }) {
  const { path, localPath, title, markdownUrl, githubUrl, publicUrl, generated } = target;
  const value = useMemo(
    () => ({ path, localPath, title, markdownUrl, githubUrl, publicUrl, generated }),
    [path, localPath, title, markdownUrl, githubUrl, publicUrl, generated],
  );

  return <TargetContext.Provider value={value}>{children}</TargetContext.Provider>;
}

/** The current doc's repo-relative path, title and canonical URLs. */
export function useDocTarget(): DocTarget {
  const target = useContext(TargetContext);

  if (target === null) {
    throw new Error("useDocTarget() only works inside a doc's article.");
  }

  return target;
}
