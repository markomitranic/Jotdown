"use client";

import type { ComponentProps } from "react";
import { DocsShell, SidebarFooter } from "@jotdown/core/components/DocsShell";
import { ArrangeableSidebar } from "@jotdown/editor/components/sidebar/ArrangeableSidebar";
import { StudioTools } from "@/components/studio/StudioTools";
import { WorkspaceMenu } from "@/components/studio/Workspace";
import { TitleBarControls } from "@/components/WindowTitleBar";

type Props = Omit<ComponentProps<typeof DocsShell>, "sidebar" | "navTitle" | "footer">;

/**
 * The docs shell as the studio draws it: the arranging sidebar, the workspace menu behind the logo and the studio's own footer.
 *
 * The logo at the top of the sidebar is the workspace menu that switches
 * projects. The foot of the sidebar shows the studio's tools beside the theme
 * switch.
 *
 * @example <StudioShell tree={tree} tabs={tabs} title={logo} base="/owner/repo">{page}</StudioShell>
 */
export function StudioShell({ children, ...shell }: Props) {
  return (
    <DocsShell
      {...shell}
      sidebar={ArrangeableSidebar}
      navTitle={WorkspaceMenu}
      footer={
        <SidebarFooter>
          <StudioTools />
        </SidebarFooter>
      }
    >
      <TitleBarControls />
      {children}
    </DocsShell>
  );
}
