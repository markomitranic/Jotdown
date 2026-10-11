"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SidebarOffer } from "@jotdown/core/components/SidebarOffer";
import appIcon from "./jotdown-icon.png";

const RELEASES = "https://github.com/markomitranic/Jotdown/releases/latest";
const DISMISSED_UNTIL = "jotdown-edit-dismissed-until";
const APP_SEEN = "jotdown-app-seen";
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

/** How long a click on Open waits for the app to take focus before offering the download. */
const PATIENCE = 1500;

/** How long a slow confirmation, such as the browser asking whether to open the app, still counts as the app opening. */
const LATE_FOCUS = 15_000;

type Offer = "hidden" | "edit" | "install";

const listeners = new Set<() => void>();
let missed = false;

/**
 * The way from the page being read to the same page in the Jotdown app, at the foot of the sidebar.
 *
 * A page cannot ask whether an app is installed, so Open tries the link and
 * watches the window: when the app takes focus it is remembered as installed,
 * and when nothing happens the offer turns into the download. Shown on a Mac
 * only, the one system the app is built for. Put away, it stays away in this
 * browser for two days.
 *
 * @example <EditInJotdown project="you/notes" />
 */
export function EditInJotdown({ project }: { project: string }) {
  const pathname = usePathname();
  const offer = useSyncExternalStore(subscribe, currentOffer, () => "hidden" as const);
  const page = pathname.replace(/^\/|\/$/g, "");
  const link = `jotdown://open/${project}${page && `/${page}`}`;

  if (offer === "hidden") return null;

  if (offer === "install")
    return (
      <SidebarOffer
        icon={appIcon.src}
        title="No app yet?"
        detail="Jotdown for Mac"
        action="Install"
        href={RELEASES}
        onDismiss={dismiss}
      />
    );

  return (
    <SidebarOffer
      icon={appIcon.src}
      title="Edit this page"
      detail="In the Jotdown app"
      action="Open"
      onAction={() => open(link)}
      onDismiss={dismiss}
    />
  );
}

/**
 * Opens the link in the app, and offers the download when the window keeps its focus.
 *
 * Once the app has been seen taking focus, a slow start never turns the offer.
 *
 * @example open("jotdown://open/you/notes/setup");
 */
function open(link: string) {
  const seen = localStorage.getItem(APP_SEEN) === "1";
  const giveUp = seen ? undefined : setTimeout(() => announce(true), PATIENCE);

  const opened = () => {
    clearTimeout(giveUp);
    localStorage.setItem(APP_SEEN, "1");
    announce(false);
  };
  window.addEventListener("blur", opened, { once: true });
  setTimeout(() => window.removeEventListener("blur", opened), LATE_FOCUS);

  location.href = link;
}

/**
 * Which offer the sidebar shows: none off a Mac or while put away, the download after a miss, and Open otherwise.
 *
 * @example currentOffer(); // "edit"
 */
function currentOffer(): Offer {
  const mac = navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints < 2;
  if (!mac || Number(localStorage.getItem(DISMISSED_UNTIL)) > Date.now()) return "hidden";
  return missed ? "install" : "edit";
}

function announce(miss: boolean) {
  missed = miss;
  for (const listener of listeners) listener();
}

function dismiss() {
  localStorage.setItem(DISMISSED_UNTIL, String(Date.now() + TWO_DAYS));
  announce(false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
