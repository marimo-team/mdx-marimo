import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { MarimoPageRequest, MarimoPageResult } from "../schema";
import { readCachedResult, writeCachedResult } from "./cache";
import { extractorArgs, resolveUvCommand, type UvOptions } from "./uv";

export type ExtractMarimoOptions = UvOptions & {
  timeoutMs?: number;
};

const extractorScriptUrl = new URL("./extract-marimo.py", import.meta.url);

export async function extractMarimo(
  request: MarimoPageRequest,
  options: ExtractMarimoOptions = {},
): Promise<MarimoPageResult> {
  const cacheDir = join(options.cwd ?? process.cwd(), ".marimo-cache");
  const cached = await readCachedResult(cacheDir, request, extractorScriptUrl);
  if (cached) return cached;

  const command = resolveUvCommand(options);
  const args = extractorArgs(request.metadata.pyproject, fileURLToPath(extractorScriptUrl));
  const result = await runExtractor(command, args, request, options);
  await writeCachedResult(cacheDir, request, extractorScriptUrl, result);
  return result;
}

function runExtractor(
  command: string,
  args: string[],
  request: MarimoPageRequest,
  options: ExtractMarimoOptions,
): Promise<MarimoPageResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`marimo extraction timed out after ${options.timeoutMs ?? 300000}ms`));
    }, options.timeoutMs ?? 300000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(`marimo extraction failed with exit ${code}\n${stderr}\n${stdout}`.trim()),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as MarimoPageResult);
      } catch (error) {
        reject(
          new Error(`marimo extraction returned invalid JSON\n${stderr}\n${stdout}`, {
            cause: error,
          }),
        );
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
