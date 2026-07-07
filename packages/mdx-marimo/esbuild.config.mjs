import { spawn } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const distDir = join(packageRoot, "dist");

const entryPoints = [
  "src/index.ts",
  "src/remark/index.ts",
  "src/browser/index.ts",
  "src/element/auto.ts",
  "src/element/index.ts",
  "src/extractor/index.ts",
  "src/preset/index.ts",
  "src/adapters/react/browser.ts",
  "src/adapters/react/index.ts",
  "src/adapters/vue/index.ts",
  "src/schema.ts",
];
const styleSources = [
  "src/styling/tokens.css",
  "src/styling/layout.css",
  "src/styling/compatibility.css",
];

await run(process.platform === "win32" ? "tsc.cmd" : "tsc", [
  "-p",
  "tsconfig.build.json",
  "--emitDeclarationOnly",
]);
await build({
  absWorkingDir: packageRoot,
  entryPoints,
  bundle: true,
  format: "esm",
  platform: "neutral",
  packages: "external",
  external: [
    "node:*",
    "@marimo-team/mdx-marimo/extractor",
    "@marimo-team/mdx-marimo/preset",
    "@marimo-team/mdx-marimo/remark",
    "@marimo-team/mdx-marimo/schema",
  ],
  sourcemap: true,
  outbase: "src",
  outdir: "dist",
});
await copyFile(
  join(packageRoot, "src", "extractor", "extract-marimo.py"),
  join(distDir, "extractor", "extract-marimo.py"),
);
await writeFile(
  join(distDir, "styles.css"),
  `${(
    await Promise.all(styleSources.map((file) => readFile(join(packageRoot, file), "utf8")))
  ).join("\n")}\n`,
);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: packageRoot, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}
