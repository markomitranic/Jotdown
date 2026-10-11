import type { ReactNode } from "react";
import { DocsPage } from "@jotdown/core/components/docs/page";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@jotdown/core/components/ui/empty";

type Props = {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** The way forward, one primary button and at most one quiet one. */
  children?: ReactNode;
};

/**
 * A whole page that says why there is nothing to read here, and what to do about it.
 *
 * The studio's empty, missing and failed states all stand in this one frame, so
 * an editor meets the same layout whatever went wrong.
 *
 * @example <StudioState icon={<FilePlus />} title="No pages yet" description="…"><Button>Write the first page</Button></StudioState>
 */
export function StudioState({ icon, title, description, children }: Props) {
  return (
    <DocsPage full breadcrumb={false} footer={false}>
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle className="text-base">{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {children && <EmptyContent className="flex-row justify-center">{children}</EmptyContent>}
      </Empty>
    </DocsPage>
  );
}
