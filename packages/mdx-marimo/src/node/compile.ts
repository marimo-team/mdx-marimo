import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  isCompiledMarimoPage,
  type CompiledMarimoPage,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";
import { readCachedResult, writeCachedResult } from "./cache";
import { compilerArgs, resolveUvCommand, type UvOptions } from "./uv";

export type CompileMarimoPageOptions = UvOptions & {
  cacheDir?: string | false;
  timeoutMs?: number;
};

const compilerScriptUrl = new URL("./compile-page.py", import.meta.url);

export async function compileMarimoPage(
  request: MarimoPageRequest,
  options: CompileMarimoPageOptions = {},
): Promise<CompiledMarimoPage> {
  const cacheDir = defaultCacheDir(options);
  const cached = cacheDir
    ? await readCachedResult(cacheDir, request, compilerScriptUrl)
    : undefined;
  if (cached) {
    return cached;
  }

  const command = resolveUvCommand(options);
  const args = compilerArgs(request.metadata.pyproject, fileURLToPath(compilerScriptUrl));
  const result = await runCompiler(command, args, request, options);
  if (cacheDir) {
    await writeCachedResult(cacheDir, request, compilerScriptUrl, result);
  }
  return result;
}

function defaultCacheDir(options: CompileMarimoPageOptions): string | undefined {
  if (options.cacheDir === false) {
    return undefined;
  }
  if (typeof options.cacheDir === "string") {
    return options.cacheDir;
  }
  return join(options.cwd ?? process.cwd(), "node_modules", ".cache", "@marimo-team", "mdx-marimo");
}

function runCompiler(
  command: string,
  args: string[],
  request: MarimoPageRequest,
  options: CompileMarimoPageOptions,
): Promise<CompiledMarimoPage> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`marimo page compilation timed out after ${options.timeoutMs ?? 300000}ms`));
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
          new Error(
            `marimo page compilation failed with exit ${code}\n${stderr}\n${stdout}`.trim(),
          ),
        );
        return;
      }
      try {
        const parsed: unknown = JSON.parse(stdout);
        if (!isCompiledMarimoPage(parsed)) {
          throw new Error("compiler returned an invalid marimo page protocol payload");
        }
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(`marimo page compilation returned invalid output\n${stderr}\n${stdout}`, {
            cause: error,
          }),
        );
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
