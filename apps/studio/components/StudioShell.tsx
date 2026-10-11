"use client";

import type { ComponentProps } from "react";
import { DocsShell } from "@jotdown/core/components/DocsShell";
import { ArrangeableSidebar } from "@jotdown/editor/components/sidebar/ArrangeableSidebar";
import { WorkspaceMenu } from "@/components/studio/Workspace";
import { StatusStrip } from "@/components/studio/status/StatusStrip";
import { TitleBarControls } from "@jotdown/core/components/WindowTitleBar";

type Props = Omit<ComponentProps<typeof DocsShell>, "sidebar" | "navTitle" | "footer">;

/**
 * The docs shell as the studio draws it: the arranging sidebar, the workspace menu behind the logo, and the status strip.
 *
 * The logo at the top of the sidebar is the workspace menu that switches
 * projects. The studio's own tools sit in the status strip along the foot of
 * the window, apart from the project's look.
 *
 * @example <StudioShell tree={tree} tabs={tabs} title={logo} base="/owner/repo">{page}</StudioShell>
 */
export function StudioShell({ children, ...shell }: Props) {
  return (
    <DocsShell {...shell} sidebar={ArrangeableSidebar} navTitle={WorkspaceMenu}>
      <TitleBarControls />
      {children}
      <StatusStrip />
    </DocsShell>
  );
}
