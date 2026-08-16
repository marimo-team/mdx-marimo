import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parse as parseToml, type TomlValueWithoutBigInt } from "smol-toml";

export type UvOptions = {
  cwd?: string;
  uvCommand?: string;
};

const defaultMarimoDependency = "marimo>=0.23.15";
const defaultPythonVersion = "3.12";
const nodeRequire = createRequire(import.meta.url);

type PyprojectDocument = {
  dependencies: TomlValueWithoutBigInt | undefined;
  "requires-python": TomlValueWithoutBigInt | undefined;
};

export function resolveUvCommand(options: UvOptions = {}): string {
  if (options.uvCommand) return options.uvCommand;
  if (process.env.MDX_MARIMO_UV) return process.env.MDX_MARIMO_UV;
  const local = join(options.cwd ?? process.cwd(), "node_modules", ".bin", uvBinName());
  if (existsSync(local)) return local;
  const npmUv = resolveNpmUvCommand();
  if (npmUv) return npmUv;
  return "uv";
}

export function compilerArgs(pyproject: string | undefined, compilerPath: string): string[] {
  const document = parsePyproject(pyproject);
  return [
    "run",
    "--python",
    pythonRequest(document),
    ...dependencyArgs(document),
    "python",
    compilerPath,
  ];
}

function uvBinName(): string {
  return process.platform === "win32" ? "uv.cmd" : "uv";
}

function resolveNpmUvCommand(): string | undefined {
  try {
    return join(dirname(nodeRequire.resolve("@manzt/uv/package.json")), "bin.cjs");
  } catch {
    return undefined;
  }
}

function dependencyArgs(document: PyprojectDocument): string[] {
  const dependencies = pyprojectDependencies(document);
  const resolvedDependencies = dependencies.some(isMarimoDependency)
    ? dependencies
    : [defaultMarimoDependency, ...dependencies];
  return resolvedDependencies.flatMap((dependency) => ["--with", dependency]);
}

function pythonRequest(document: PyprojectDocument): string {
  const requirement = pyprojectRequiresPython(document);
  if (!requirement) return defaultPythonVersion;

  const parts = requirement
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const exact = versionForOperator(parts, "==") ?? versionForOperator(parts, "~=");
  if (exact) return exact;

  const inclusive = versionForOperator(parts, ">=");
  const exclusive = versionForOperator(parts, ">");
  const lowerBound = inclusive ?? (exclusive ? nextMinor(exclusive) : undefined);
  if (!lowerBound) return requirement;

  const candidate = maxVersion(defaultPythonVersion, lowerBound);
  return satisfiesUpperBounds(candidate, parts) ? candidate : requirement;
}

function pyprojectRequiresPython(document: PyprojectDocument): string | undefined {
  const requirement = tomlString(document["requires-python"]);
  return requirement?.trim() ? requirement : undefined;
}

function versionForOperator(parts: string[], operator: string): string | undefined {
  const escapedOperator = operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedOperator}\\s*(\\d+(?:\\.\\d+){0,2})(?:\\.\\*)?$`);
  return parts.map((part) => part.match(pattern)?.[1]).find(Boolean);
}

function satisfiesUpperBounds(candidate: string, parts: string[]): boolean {
  for (const part of parts) {
    const match = part.match(/^(<|<=)\s*(\d+(?:\.\d+){0,2})$/);
    if (!match?.[1] || !match[2]) continue;
    const comparison = compareVersions(candidate, match[2]);
    if (match[1] === "<" ? comparison >= 0 : comparison > 0) return false;
  }
  return true;
}

function maxVersion(left: string, right: string): string {
  return compareVersions(left, right) >= 0 ? left : right;
}

function nextMinor(version: string): string {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  return `${major}.${minor + 1}`;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function pyprojectDependencies(document: PyprojectDocument): string[] {
  const dependencies = document.dependencies;
  if (!Array.isArray(dependencies)) return [];
  return dependencies.flatMap((dependency) => {
    const parsed = tomlString(dependency);
    return parsed === undefined ? [] : [parsed];
  });
}

function parsePyproject(pyproject: string | undefined): PyprojectDocument {
  if (!pyproject?.trim()) {
    return { dependencies: undefined, "requires-python": undefined };
  }
  const source = pyproject.trim();
  const lines = source.split(/\r?\n/);
  const toml =
    lines[0] === "# /// script" && lines.at(-1) === "# ///"
      ? lines
          .slice(1, -1)
          .map((line) => {
            if (!line.startsWith("#")) throw new Error("Invalid PEP 723 script metadata");
            if (line.startsWith("# ")) return line.slice(2);
            return line.slice(1);
          })
          .join("\n")
      : source;
  const document = parseToml(toml, { integersAsBigInt: false });
  return {
    dependencies: document.dependencies,
    "requires-python": document["requires-python"],
  };
}

function isMarimoDependency(dependency: string): boolean {
  return /^marimo(?:$|[\s[<>=!~@;])/.test(dependency.trim().toLowerCase());
}

function tomlString(value: TomlValueWithoutBigInt | undefined): string | undefined {
  return isTomlString(value) ? value : undefined;
}

function isTomlString(value: TomlValueWithoutBigInt | undefined): value is string {
  return Object(value) !== value && Object.prototype.toString.call(value) === "[object String]";
}
