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
  const theme = themeStylesheet(project.config.theme, project.base);
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
      src: atBase(project, logo.src),
      srcDark: logo.srcDark && atBase(project, logo.srcDark),
    }
  );
}

/**
 * The project's square icon as the project serves it: its favicon, else its logo, or undefined when it has neither.
 *
 * @example projectIcon(project); // { alt: "Handbook", src: "/you/notes/uploads/icon.png", srcDark: undefined }
 */
export function projectIcon(project: Project) {
  const { favicon, title } = project.config;
  if (!favicon) return projectLogo(project);
  return { alt: title, src: atBase(project, favicon), srcDark: undefined };
}

/**
 * What the top of the sidebar says: the project's icon in a fixed square beside the title, or the title alone.
 *
 * The square holds whatever it is given, so a wide logo standing in for an
 * icon shrinks to fit rather than pushing the title aside.
 *
 * @example <ProjectTitle project={project} />
 */
export function ProjectTitle({ project }: { project: Project }) {
  const { title } = project.config;
  const icon = projectIcon(project);

  if (!icon) return <span className="font-semibold">{title}</span>;

  return (
    <>
      <Image
        src={icon.src}
        alt={icon.alt}
        width={48}
        height={48}
        unoptimized={!optimizable(icon.src)}
        className="size-6 shrink-0 object-contain dark:hidden"
      />
      <Image
        src={icon.srcDark ?? icon.src}
        alt={icon.alt}
        width={48}
        height={48}
        unoptimized={!optimizable(icon.srcDark ?? icon.src)}
        className="hidden size-6 shrink-0 object-contain dark:block"
      />
      <span className="truncate font-semibold max-md:hidden">{title}</span>
    </>
  );
}
