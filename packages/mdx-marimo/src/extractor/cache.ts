import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MarimoPageRequest, MarimoPageResult } from "../schema";

export async function readCachedResult(
  cacheDir: string,
  request: MarimoPageRequest,
  extractorScriptUrl: URL,
): Promise<MarimoPageResult | undefined> {
  const cachePath = resultCachePath(cacheDir, request, extractorScriptUrl);
  if (!existsSync(cachePath)) return undefined;
  return JSON.parse(await readFile(cachePath, "utf8")) as MarimoPageResult;
}

export async function writeCachedResult(
  cacheDir: string,
  request: MarimoPageRequest,
  extractorScriptUrl: URL,
  result: MarimoPageResult,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(resultCachePath(cacheDir, request, extractorScriptUrl), JSON.stringify(result));
}

function resultCachePath(
  cacheDir: string,
  request: MarimoPageRequest,
  extractorScriptUrl: URL,
): string {
  return join(cacheDir, `${cacheKey(request, extractorScriptUrl)}.json`);
}

function cacheKey(request: MarimoPageRequest, extractorScriptUrl: URL): string {
  const extractorSource = readFileSync(extractorScriptUrl, "utf8");
  return createHash("sha256")
    .update(JSON.stringify(request))
    .update("\0")
    .update(extractorSource)
    .digest("hex");
}
