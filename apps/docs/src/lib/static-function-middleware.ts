import fs from "node:fs/promises";
import path from "node:path";
import {
  createMiddleware,
  getDefaultSerovalPlugins,
  X_TSS_SERIALIZED,
  type CustomFetch,
  type ServerFnMiddlewareOptions,
  type ServerFnMiddlewareResult,
} from "@tanstack/react-start";
import { toCrossJSONAsync } from "seroval";
import { withBasePath } from "@/lib/base-path";

async function sha1Hash(message: string) {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-1", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface StaticCacheEntry {
  data: ServerFnMiddlewareOptions["data"];
  functionId: string;
  result: ServerFnMiddlewareResult["result"];
  sendContext: ServerFnMiddlewareOptions["sendContext"];
}

function jsonToFilenameSafeString(value: ServerFnMiddlewareOptions["data"]) {
  const json = JSON.stringify(value ?? "", (_key, item) => {
    if (item === null || Object(item) !== item || Array.isArray(item) || item instanceof Function) {
      return item;
    }

    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]]),
    );
  });

  return json.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
}

async function getStaticCachePath(functionId: string, data: ServerFnMiddlewareOptions["data"]) {
  const hash = jsonToFilenameSafeString(data);
  const filename = await sha1Hash(`${functionId}__${hash}`);
  return `/__tsr/staticServerFnCache/${filename}.json`;
}

async function writeCacheItem({ data, functionId, result, sendContext }: StaticCacheEntry) {
  const outputDir = process.env.TSS_CLIENT_OUTPUT_DIR;
  if (!outputDir) return;

  const cachePath = await getStaticCachePath(functionId, data);
  const filePath = path.join(outputDir, cachePath.slice(1));
  const payload = await toCrossJSONAsync(
    { result, context: sendContext },
    { plugins: getDefaultSerovalPlugins() },
  );

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload), "utf-8");
}

async function fetchCacheResponse(
  functionId: string,
  data: ServerFnMiddlewareOptions["data"],
  signal?: AbortSignal | null,
) {
  const cachePath = await getStaticCachePath(functionId, data);
  const response = await fetch(withBasePath(cachePath), { signal });
  if (!response.ok) throw new Error(`Static server function cache returned ${response.status}.`);

  const headers = new Headers(response.headers);
  headers.set(X_TSS_SERIALIZED, "true");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const staticFunctionMiddleware = createMiddleware({ type: "function" })
  .client(async (context) => {
    if (process.env.NODE_ENV === "production" && globalThis.document !== undefined) {
      // Keep static responses in TanStack's normal middleware pipeline so it
      // owns result deserialization and hydration context merging.
      const fetchFromStaticCache: CustomFetch = (_input, init) =>
        fetchCacheResponse(context.serverFnMeta.id, context.data, init?.signal);

      return context.next({ fetch: fetchFromStaticCache });
    }

    return context.next();
  })
  .server(async (context) => {
    const response = await context.next();

    if (process.env.NODE_ENV === "production") {
      await writeCacheItem({
        data: context.data,
        functionId: context.serverFnMeta.id,
        result: "result" in response ? response.result : undefined,
        sendContext: "sendContext" in context ? context.sendContext : undefined,
      });
    }

    return response;
  });
