import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parse as parseToml } from "smol-toml";

export type UvOptions = {
  cwd?: string;
  uvCommand?: string;
};

const defaultMarimoDependency = "marimo>=0.23.13";
const extractorDependencies = ['tomli>=2; python_version < "3.11"'];
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

export function extractorArgs(pyproject: string | undefined, extractorPath: string): string[] {
  return [
    "run",
    ...pythonRequirementArgs(pyproject),
    ...dependencyArgs(pyproject),
    "python",
    extractorPath,
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
  return [...resolvedDependencies, ...extractorDependencies].flatMap((dependency) => [
    "--with",
    dependency,
  ]);
}

function pythonRequirementArgs(pyproject: string | undefined): string[] {
  const requiresPython = pyprojectRequiresPython(pyproject);
  return requiresPython ? ["--python", pythonRequestFromRequirement(requiresPython)] : [];
}

function pyprojectRequiresPython(pyproject: string | undefined): string | undefined {
  if (!pyproject?.trim()) return undefined;
  const document = parseToml(pyproject) as { "requires-python"?: unknown };
  const requiresPython = document["requires-python"];
  return typeof requiresPython === "string" && requiresPython.trim() ? requiresPython : undefined;
}

function pythonRequestFromRequirement(requiresPython: string): string {
  const parts = requiresPython
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const operator of ["==", "~=", ">="]) {
    const match = parts
      .map((part) => part.match(new RegExp(`^${operator}\\s*(\\d+(?:\\.\\d+){0,2})(?:\\.\\*)?$`)))
      .find((partMatch) => partMatch?.[1]);
    if (match?.[1]) return match[1];
  }

  const exclusiveLowerBound = parts
    .map((part) => part.match(/^>\s*(\d+)\.(\d+)$/))
    .find((partMatch) => partMatch?.[1] && partMatch[2]);
  if (exclusiveLowerBound?.[1] && exclusiveLowerBound[2]) {
    return `${exclusiveLowerBound[1]}.${Number(exclusiveLowerBound[2]) + 1}`;
  }

  return requiresPython;
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
