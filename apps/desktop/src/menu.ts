import { ApplicationMenu } from "electrobun/bun";

/**
 * The menu bar: the app, Edit, View and Window menus a Mac app is expected to have.
 *
 * The Edit menu is what makes Cmd+C, Cmd+V, Cmd+Z and their friends reach the
 * page at all: WebKit takes those keys from the menu, not from the keyboard.
 * The app and window items name their shortcuts outright, since a role alone
 * gets no key equivalent.
 *
 * @example setMenu();
 */
export function setMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { role: "about" },
        { type: "divider" },
        { role: "hide", accelerator: "CommandOrControl+H" },
        { role: "hideOthers", accelerator: "CommandOrControl+Alt+H" },
        { role: "showAll" },
        { type: "divider" },
        { role: "quit", accelerator: "CommandOrControl+Q" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "divider" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [{ label: "Reload", action: "reload", accelerator: "CommandOrControl+R" }, { role: "toggleFullScreen" }],
    },
    {
      label: "Window",
      submenu: [
        { role: "close", accelerator: "CommandOrControl+W" },
        { role: "minimize", accelerator: "CommandOrControl+M" },
        { role: "zoom" },
        { type: "divider" },
        { role: "bringAllToFront" },
      ],
    },
  ]);
}
