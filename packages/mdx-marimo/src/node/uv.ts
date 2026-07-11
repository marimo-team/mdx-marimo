import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parse as parseToml } from "smol-toml";

export type UvOptions = {
  cwd?: string;
  uvCommand?: string;
};

const defaultMarimoDependency = "marimo>=0.23.13";
const defaultPythonVersion = "3.12";
const nodeRequire = createRequire(import.meta.url);

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
  return [
    "run",
    "--python",
    pythonRequest(pyproject),
    ...dependencyArgs(pyproject),
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

function dependencyArgs(pyproject: string | undefined): string[] {
  const dependencies = pyprojectDependencies(pyproject);
  const resolvedDependencies = dependencies.some(isMarimoDependency)
    ? dependencies
    : [defaultMarimoDependency, ...dependencies];
  return resolvedDependencies.flatMap((dependency) => ["--with", dependency]);
}

function pythonRequest(pyproject: string | undefined): string {
  const requirement = pyprojectRequiresPython(pyproject);
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

function pyprojectRequiresPython(pyproject: string | undefined): string | undefined {
  if (!pyproject?.trim()) return undefined;
  const document = parseToml(pyproject) as { "requires-python"?: unknown };
  const requirement = document["requires-python"];
  return typeof requirement === "string" && requirement.trim() ? requirement : undefined;
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

function pyprojectDependencies(pyproject: string | undefined): string[] {
  if (!pyproject?.trim()) return [];
  const document = parseToml(pyproject) as { dependencies?: unknown };
  const dependencies = document.dependencies;
  if (!Array.isArray(dependencies)) return [];
  return dependencies.filter((dependency): dependency is string => typeof dependency === "string");
}

function isMarimoDependency(dependency: string): boolean {
  return /^marimo(?:$|[\s[<>=!~@;])/.test(dependency.trim().toLowerCase());
}
