import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isCompiledMarimoPage,
  type CompiledMarimoPage,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";

export async function readCachedResult(
  cacheDir: string,
  request: MarimoPageRequest,
  compilerScriptUrl: URL,
): Promise<CompiledMarimoPage | undefined> {
  const cachePath = resultCachePath(cacheDir, request, compilerScriptUrl);
  if (!existsSync(cachePath)) return undefined;
  const result: unknown = JSON.parse(await readFile(cachePath, "utf8"));
  return isCompiledMarimoPage(result) ? result : undefined;
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
