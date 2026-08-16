import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseCompiledMarimoPage,
  type CompiledMarimoPage,
  type JsonValue,
  type MarimoPageRequest,
} from "@marimo-team/mdx-marimo/bridge/protocol";

export async function readCachedResult(
  cacheDir: string,
  request: MarimoPageRequest,
  compilerScriptUrl: URL,
): Promise<CompiledMarimoPage | undefined> {
  const cachePath = resultCachePath(cacheDir, request, compilerScriptUrl);
  if (!existsSync(cachePath)) return undefined;
  const decoded: JsonValue = JSON.parse(await readFile(cachePath, "utf8"));
  return parseCompiledMarimoPage(decoded);
}

export async function writeCachedResult(
  cacheDir: string,
  request: MarimoPageRequest,
  compilerScriptUrl: URL,
  result: CompiledMarimoPage,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(resultCachePath(cacheDir, request, compilerScriptUrl), JSON.stringify(result));
}

function resultCachePath(
  cacheDir: string,
  request: MarimoPageRequest,
  compilerScriptUrl: URL,
): string {
  return join(cacheDir, `${cacheKey(request, compilerScriptUrl)}.json`);
}

function cacheKey(request: MarimoPageRequest, compilerScriptUrl: URL): string {
  const compilerSource = readFileSync(compilerScriptUrl, "utf8");
  return createHash("sha256")
    .update(JSON.stringify(request))
    .update("\0")
    .update(compilerSource)
    .digest("hex");
}
