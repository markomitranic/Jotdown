"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { SetupApi } from "./api";
import { SetupWizard } from "./SetupWizard";
import { closeSetup, useSetupRequest } from "./store";

type Props = {
  /** Opens a project the way the switcher does, once the window has closed. */
  onOpenProject: (key: string, title: string, bookmark: boolean) => void;
  api?: SetupApi;
};

/**
 * The setup wizard's window over whatever page asked for it, opened with `openSetup`.
 *
 * Mounted once beside the project switcher, on the welcome page and in a
 * project. Opening a project from it closes the window first, so the opening
 * screen is the switcher's own.
 *
 * @example <SetupDialog onOpenProject={start} />
 */
export function SetupDialog({ onOpenProject, api }: Props) {
  const { open, start, opening } = useSetupRequest();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && closeSetup()}>
      <DialogPrimitive.Portal>
        <SetupWizard
          key={opening}
          start={start}
          api={api}
          onClose={closeSetup}
          onOpenProject={(key, title, bookmark) => {
            closeSetup();
            onOpenProject(key, title, bookmark);
          }}
        />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
