import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import Link from "fumadocs-core/link";

/**
 * A grid of cards, two across, one across when the grid is narrow.
 *
 * Adapted from Fumadocs UI, MIT.
 *
 * @example <Cards><Card title="Install" href="/install" /></Cards>
 */
export function Cards({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("@container grid grid-cols-2 gap-3", className)} />;
}

type CardProps = Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  external?: boolean;
};

/**
 * One card: an icon, a title, a line under it, and a link when it leads somewhere.
 *
 * @example <Card title="Install" description="Get it running" href="/install" />
 */
export function Card({ icon, title, description, href, external, className, children, ...props }: CardProps) {
  const body = (
    <>
      {icon ? (
        <div className="not-prose mb-2 w-fit rounded-lg border bg-muted p-1.5 text-muted-foreground shadow-md [&_svg]:size-4">
          {icon}
        </div>
      ) : null}
      <h3 className="not-prose mb-1 font-medium text-sm">{title}</h3>
      {description ? <p className="my-0! text-muted-foreground text-sm">{description}</p> : null}
      <div className="prose-no-margin text-muted-foreground text-sm empty:hidden">{children}</div>
    </>
  );
  const look = cn(
    "@max-lg:col-span-full block rounded-xl border bg-card p-4 text-card-foreground transition-colors",
    href && "hover:bg-accent/80",
    className,
  );

  if (href)
    return (
      <Link href={href} external={external} data-card="" className={look}>
        {body}
      </Link>
    );

  return (
    <div {...props} data-card="" className={look}>
      {body}
    </div>
  );
}
