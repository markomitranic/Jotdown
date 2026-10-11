"use client";

import type { ComponentProps, ComponentType } from "react";
import { blocksOf, type LayoutProps } from "@jotdown/kit";
import * as project from "@project";
import { Canvas } from "@jotdown/editor/canvas/Canvas";

const blocks = blocksOf(project);
const layouts: Record<string, ComponentType<LayoutProps>> = project.layouts;

/**
 * The editing canvas with the project's own blocks and layouts, which only the browser bundle can hand it.
 *
 * @example <ProjectCanvas title={<ProjectTitle project={site} />} project={{ title: "Notes" }} site={site} framework="0.3.0" />
 */
export function ProjectCanvas(props: Omit<ComponentProps<typeof Canvas>, "blocks" | "layouts">) {
  return <Canvas {...props} blocks={blocks} layouts={layouts} />;
}
