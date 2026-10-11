/**
 * Renders an editorial illustration's SVG file to PNG, by day and at `#dark`, the way a page shows it.
 *
 * The file is drawn as an image at the column's width, the same as the page
 * draws it, so a reference outside the file or a palette `:target` never
 * reaches shows up here first. Prints the path of every screenshot it wrote.
 *
 * @example bun .agents/skills/editorial-illustration/scripts/render.ts docs/_uploads/img/docs/illustration-home.svg
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const [filePath] = process.argv.slice(2);
if (!filePath?.endsWith(".svg")) throw new Error("Usage: bun render.ts <illustration.svg>");

const file = resolve(filePath);
const out = join("/tmp", "illustrations", basename(file, ".svg"));
await mkdir(out, { recursive: true });

const MODES = {
  light: { ground: "#ffffff", address: `file://${file}` },
  dark: { ground: "#09090b", address: `file://${file}#dark` },
};

for (const [mode, { ground, address }] of Object.entries(MODES)) {
  const html = join(out, `${mode}.html`);
  const png = join(out, `${mode}.png`);
  await writeFile(
    html,
    `<!doctype html><body style="margin:0;padding:24px;background:${ground}"><img src="${address}" style="display:block;width:960px;height:auto"></body>`,
  );
  await run(["agent-browser", "open", `file://${html}`]);
  await run(["agent-browser", "set", "viewport", "1008", "588"]);
  await run(["agent-browser", "screenshot", png]);
  console.log(png);
}

function run([command, ...args]: string[]) {
  return new Promise<void>((done, fail) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} failed`))));
  });
}
