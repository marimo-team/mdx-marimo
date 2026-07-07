import { basename, isAbsolute, relative } from "node:path";
import type { MarimoCell, MarimoDiagnostic, MarimoPageRequest, MdxMarimoOptions } from "../schema";

export function pageRequest({
  cells,
  diagnostics,
  filename,
  identity,
  filePath,
  pyproject,
}: {
  cells: MarimoCell[];
  diagnostics: MarimoDiagnostic[];
  filename: string;
  identity: MdxMarimoOptions["identity"];
  filePath: string | undefined;
  pyproject: string | undefined;
}): MarimoPageRequest {
  const metadata: MarimoPageRequest["metadata"] = {};
  if (pyproject !== undefined) metadata.pyproject = pyproject;
  return {
    filename,
    identity: resolveIdentity(identity, { cells, filePath, filename, pyproject }),
    metadata,
    diagnostics,
    cells,
  };
}

export function publicFilename(filename: string, cwd: string | undefined): string {
  if (!isAbsolute(filename)) return filename;
  const root = cwd ?? process.cwd();
  const candidate = relative(root, filename);
  if (!candidate.startsWith("..") && !isAbsolute(candidate)) return candidate;
  return basename(filename);
}

function resolveIdentity(
  identity: MdxMarimoOptions["identity"],
  context: {
    cells: MarimoCell[];
    filePath: string | undefined;
    filename: string;
    pyproject: string | undefined;
  },
): string {
  if (typeof identity === "string") return identity;
  if (typeof identity === "function") {
    return identity({ filePath: context.filePath, filename: context.filename });
  }
  return context.filePath ?? `document:${stableHash(context)}`;
}

function stableHash(value: unknown): string {
  const source = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
