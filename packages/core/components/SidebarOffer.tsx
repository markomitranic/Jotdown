"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { optimizable } from "@jotdown/core/lib/images";
import { Button } from "@jotdown/core/components/ui/button";

type SidebarOfferProps = {
  icon: string;
  title: string;
  detail: string;
  action: string;
  onDismiss: () => void;
} & ({ href: string; onAction?: never } | { onAction: () => void; href?: never });

const ACTION = "rounded-full bg-primary/15 px-3 font-semibold text-primary hover:bg-primary/25";

/**
 * An app's offer at the foot of the sidebar: its icon, two lines, a pill that acts and a cross that puts it away.
 *
 * The pill is a link when given `href`, and a button when given `onAction`.
 *
 * @example <SidebarOffer icon="/icon.png" title="Jotdown app" detail="In your Dock" action="Install" onAction={install} onDismiss={dismiss} />
 */
export function SidebarOffer({ icon, title, detail, action, href, onAction, onDismiss }: SidebarOfferProps) {
  return (
    <div className="mb-2 flex animate-fade-in items-center gap-3 border-border border-b pb-3">
      <Image
        src={icon}
        alt=""
        width={36}
        height={36}
        unoptimized={!optimizable(icon)}
        draggable={false}
        className="size-9 shrink-0 select-none"
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-medium text-foreground text-sm">{title}</p>
        <p className="truncate text-muted-foreground text-xs">{detail}</p>
      </div>
      {href ? (
        <Button size="sm" className={ACTION} asChild>
          <a href={href}>{action}</a>
        </Button>
      ) : (
        <Button size="sm" className={ACTION} onClick={onAction}>
          {action}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        className="-ms-2 text-muted-foreground"
        aria-label="Not now"
        onClick={onDismiss}
      >
        <X />
      </Button>
    </div>
  );
}
