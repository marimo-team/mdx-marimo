import { basename, isAbsolute, relative } from "node:path";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type MarimoCellRequest,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";

export type MarimoPageIdentity =
  | string
  | ((document: { filename: string; filePath: string | undefined; source: string }) => string);

export function pageRequest({
  cells,
  filename,
  identity,
  filePath,
  pyproject,
  source,
}: {
  cells: MarimoCellRequest[];
  filename: string;
  identity: MarimoPageIdentity | undefined;
  filePath: string | undefined;
  pyproject: string | undefined;
  source: string;
}): MarimoPageRequest {
  const metadata: MarimoPageRequest["metadata"] = {};
  if (pyproject !== undefined) metadata.pyproject = pyproject;
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    filename,
    identity: resolveIdentity(identity, { cells, filePath, filename, pyproject, source }),
    metadata,
    cells,
  };
}

export function publicFilename(filename: string, cwd: string | undefined): string {
  if (isBundlerEntry(filename)) return "document.mdx";
  if (!isAbsolute(filename)) return filename;
  const root = cwd ?? process.cwd();
  const candidate = relative(root, filename);
  if (!candidate.startsWith("..") && !isAbsolute(candidate)) return candidate;
  return basename(filename);
}

function resolveIdentity(
  identity: MarimoPageIdentity | undefined,
  context: {
    cells: MarimoCellRequest[];
    filePath: string | undefined;
    filename: string;
    pyproject: string | undefined;
    source: string;
  },
): string {
  if (typeof identity === "string") return identity;
  if (typeof identity === "function") {
    return identity({
      filePath: context.filePath,
      filename: context.filename,
      source: context.source,
    });
  }
  if (isBundlerEntry(context.filePath) || !context.filePath) {
    return `document:${stableHash({
      cells: context.cells,
      pyproject: context.pyproject,
      source: context.source,
    })}`;
  }
  return context.filename;
}

function isBundlerEntry(filename: string | undefined): boolean {
  return filename !== undefined && /_mdx_bundler_entry_point-[^/\\]+\.mdx$/.test(filename);
}

function stableHash(value: unknown): string {
  const source = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 33) ^ source.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
