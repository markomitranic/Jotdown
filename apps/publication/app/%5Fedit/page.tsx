import type { Metadata } from "next";
import { ProjectTitle } from "@jotdown/core/components/ProjectLook";
import framework from "../../../../package.json";
import { publication } from "@/server/project";
import { ProjectCanvas } from "./ProjectCanvas";

export const metadata: Metadata = { title: "Editing canvas", robots: { index: false, follow: false } };

/**
 * The site's editing canvas at `/_edit`, the page the studio frames to edit the project in this site's look.
 *
 * It is written once with no content in it: everything it draws arrives from
 * the studio that frames it. A reader who lands here gets one line saying so.
 */
export default function EditCanvas() {
  const project = publication();
  const { title, description, repository, url, layout } = project.config;

  return (
    <ProjectCanvas
      title={<ProjectTitle project={project} />}
      project={{ title, repository }}
      site={{ title, description, url }}
      layout={layout}
      framework={framework.version}
    />
  );
}
