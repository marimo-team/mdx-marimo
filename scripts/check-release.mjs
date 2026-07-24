import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = readJson(join(root, "packages/mdx-marimo/package.json"));
const bridgePackageJson = readJson(join(root, "packages/islands-bridge/package.json"));
const docsPackageJson = readJson(join(root, "apps/docs/package.json"));
const packageName = packageJson.name;
const version = packageJson.version;
const packDir = join(root, "dist/npm");
let consumerDir;

try {
  if (version !== bridgePackageJson.version) {
    fail(
      `${packageName}@${version} must match ${bridgePackageJson.name}@${bridgePackageJson.version}`,
    );
  }

  consumerDir = mkdtempSync(join(tmpdir(), "mdx-marimo-release-"));
  console.log(`Checking ${packageName}@${version}`);
  run("pnpm", ["ready"], root);

  rmSync(packDir, { force: true, recursive: true });
  mkdirSync(packDir, { recursive: true });
  run("pnpm", ["pack:mdx", "--pack-destination", packDir], root);

  const tarballs = readdirSync(packDir).filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    fail(`Expected one release tarball in ${packDir}, found ${tarballs.length}`);
  }

  const tarball = join(packDir, tarballs[0]);
  writeFileSync(
    join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        name: "mdx-marimo-release-smoke",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerDir, "smoke.mjs"),
    [
      `const subpaths = ${JSON.stringify([
        packageName,
        `${packageName}/remark`,
        `${packageName}/element`,
        `${packageName}/element/auto`,
        `${packageName}/node`,
        `${packageName}/react`,
        `${packageName}/vitepress`,
      ])};`,
      "for (const subpath of subpaths) await import(subpath);",
      "console.log(`Imported ${subpaths.length} public JavaScript subpaths`);",
      "",
    ].join("\n"),
  );

  run(
    "pnpm",
    [
      "add",
      "--allow-build=@manzt/uv",
      `file:${tarball}`,
      `react@${docsPackageJson.dependencies.react}`,
    ],
    consumerDir,
  );
  run(process.execPath, ["smoke.mjs"], consumerDir);
  console.log(`Release artifact: ${tarball}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (consumerDir) rmSync(consumerDir, { force: true, recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args, cwd) {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const result = spawnSync(executable, args, { cwd, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? 1}`);
  }
}

function fail(message) {
  throw new Error(`Release check failed: ${message}`);
}
