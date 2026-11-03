"use client";

import type { ComponentProps } from "react";
import { blocksOf, type ProjectLayout } from "@jotdown/kit";
import * as project from "@project";
import { Canvas } from "@jotdown/editor/canvas/Canvas";

const blocks = blocksOf(project);
/** The project's layouts, typed so that one exported without `defineLayout` fails the site's build. */
const layouts: Record<string, ProjectLayout> = project.layouts;

/**
 * The editing canvas with the project's own blocks and layouts, which only the browser bundle can hand it.
 *
 * @example <ProjectCanvas title={<ProjectTitle project={site} />} project={{ title: "Notes" }} site={site} framework="0.3.0" />
 */
export function ProjectCanvas(props: Omit<ComponentProps<typeof Canvas>, "blocks" | "layouts">) {
  return <Canvas {...props} blocks={blocks} layouts={layouts} />;
}
