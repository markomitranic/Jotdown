import { createHash } from "node:crypto";
import Image from "next/image";
import { optimizable } from "@jotdown/core/lib/images";
import { atBase } from "@jotdown/core/lib/project-base";
import { themeStylesheet } from "@jotdown/core/lib/theme";
import type { Project } from "@jotdown/core/server/project";

/**
 * The project's theme as a stylesheet, loaded after the framework's own so it wins over it.
 *
 * @example <ProjectStyles project={project} />
 */
export function ProjectStyles({ project }: { project: Project }) {
  const theme = themeStylesheet(project.config.theme, project.assetBase ?? project.base);
  if (!theme) return null;

  return (
    <style
      href={`project-theme-${createHash("sha1").update(theme).digest("hex").slice(0, 12)}`}
      precedence="project"
      data-project-brand=""
    >
      {theme}
    </style>
  );
}

/**
 * The project's logo with its addresses as the project serves them, or undefined when it has none.
 *
 * @example projectLogo(project); // { alt: "Handbook", src: "/you/notes/uploads/logo.svg", srcDark: undefined }
 */
export function projectLogo(project: Project) {
  const { logo } = project.config;
  return (
    logo && {
      ...logo,
      src: atBase(project, logo.src, "file"),
      srcDark: logo.srcDark && atBase(project, logo.srcDark, "file"),
    }
  );
}

/**
 * What the top of the sidebar says: the logo in both colour modes beside the title, or the title alone.
 *
 * @example <ProjectTitle project={project} />
 */
export function ProjectTitle({ project }: { project: Project }) {
  const { title } = project.config;
  const logo = projectLogo(project);

  if (!logo) return <span className="font-semibold">{title}</span>;

  return (
    <>
      <Image
        src={logo.src}
        alt={logo.alt}
        width={192}
        height={48}
        unoptimized={!optimizable(logo.src)}
        className="h-6 w-auto shrink-0 dark:hidden"
      />
      <Image
        src={logo.srcDark ?? logo.src}
        alt={logo.alt}
        width={192}
        height={48}
        unoptimized={!optimizable(logo.srcDark ?? logo.src)}
        className="hidden h-6 w-auto dark:block"
      />
      <span className="truncate font-semibold max-md:hidden">{title}</span>
    </>
  );
}
