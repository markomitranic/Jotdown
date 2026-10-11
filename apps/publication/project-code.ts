import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, watch, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { contentRepository } from "./repository";

/**
 * A project's own components and layouts, brought into the site build from its `.jotdown/` folder.
 *
 * `.jotdown/components/*.tsx` are blocks, registered under the names they
 * export, and `.jotdown/layouts/*.tsx` are layouts, named after their files.
 * They are copied beside the app into `.project/`, with an index the app
 * imports as `@project`, because the bundler only reads files under its own
 * root and a project folder can be anywhere. Each file is a client component
 * unless it says otherwise, since a block reads the page through hooks and is
 * edited in the browser. In development the folders are watched, and a change
 * is copied over at once, which the dev server reloads.
 *
 * A project that needs more than React, the kit and what the framework ships
 * lists it in `.jotdown/package.json`, which is installed into the copy
 * whenever it changes.
 */

const CODE = [".tsx", ".ts", ".jsx", ".js", ".css"];

/**
 * Copies a project's components and layouts into the app and writes the index that names them.
 *
 * @example syncProjectCode("/work/notes", "/work/notes/.jotdown/framework/apps/publication/.project");
 */
export function syncProjectCode(repository: string, into: string) {
  const from = join(repository, ".jotdown");
  for (const folder of ["components", "layouts"]) {
    rmSync(join(into, folder), { recursive: true, force: true });
    mkdirSync(join(into, folder), { recursive: true });
  }

  installPackages(join(from, "package.json"), into);
  const components = copyFolder(join(from, "components"), join(into, "components"));
  const layouts = copyFolder(join(from, "layouts"), join(into, "layouts"));
  writeFileSync(join(into, "index.ts"), indexOf(components, layouts));
}

/**
 * Keeps the copy in step with the project while a dev server runs.
 *
 * @example watchProjectCode("/work/notes", into);
 */
export function watchProjectCode(repository: string, into: string) {
  for (const folder of ["components", "layouts"]) {
    const watched = join(repository, ".jotdown", folder);
    if (!existsSync(watched)) continue;
    watch(watched, { recursive: true }, () => syncProjectCode(repository, into));
  }
}

/**
 * Installs the project's own dependencies beside its copied code, once for each version of its `package.json`.
 *
 * @example installPackages("/work/notes/.jotdown/package.json", into);
 */
function installPackages(manifest: string, into: string) {
  const installed = join(into, "package.json");
  if (!existsSync(manifest)) return rmSync(installed, { force: true });

  const wanted = readFileSync(manifest, "utf8");
  if (existsSync(installed) && readFileSync(installed, "utf8") === wanted && existsSync(join(into, "node_modules")))
    return;

  writeFileSync(installed, wanted);
  execFileSync("bun", ["install", "--no-save"], { cwd: into, stdio: "inherit" });
}

/** The code files of one folder, copied as client components, by their names without extensions. */
function copyFolder(from: string, into: string) {
  if (!existsSync(from)) return [];
  cpSync(from, into, { recursive: true });

  const code = readdirSync(from).filter((file) => CODE.includes(extname(file)) && extname(file) !== ".css");
  for (const file of code) {
    const text = readFileSync(join(into, file), "utf8");
    if (!/^\s*["']use (client|server)["']/.test(text)) writeFileSync(join(into, file), `"use client";\n${text}`);
  }
  return code.map((file) => basename(file, extname(file)));
}

/**
 * The index the app imports: every component export, and every layout by its file's name.
 *
 * @example indexOf(["Hero"], ["landing"]); // 'export * from "./components/Hero";\nimport landing from …'
 */
function indexOf(components: string[], layouts: string[]) {
  return [
    "/* Written by the site build from the project's .jotdown folder. Do not edit. */",
    ...components.map((name) => `export * from "./components/${name}";`),
    ...layouts.map((name, at) => `import layout${at} from "./layouts/${name}";`),
    `export const layouts = { ${layouts.map((name, at) => `${JSON.stringify(name)}: layout${at}`).join(", ")} };`,
    "",
  ].join("\n");
}

if (import.meta.main)
  syncProjectCode(contentRepository(resolve(import.meta.dirname, "../..")), resolve(import.meta.dirname, ".project"));
