import fs from "node:fs/promises";
import path from "node:path";
import {
  createMiddleware,
  getDefaultSerovalPlugins,
  X_TSS_SERIALIZED,
  type CustomFetch,
} from "@tanstack/react-start";
import { toCrossJSONAsync } from "seroval";
import { withBasePath } from "@/lib/base-path";

async function sha1Hash(message: string) {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-1", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonToFilenameSafeString(value: unknown) {
  const json = JSON.stringify(value ?? "", (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;

    const record = item as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, record[key]]),
    );
  });

  return json.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
}

async function getStaticCachePath(functionId: string, data: unknown) {
  const hash = jsonToFilenameSafeString(data);
  const filename = await sha1Hash(`${functionId}__${hash}`);
  return `/__tsr/staticServerFnCache/${filename}.json`;
}

async function writeCacheItem({
  data,
  functionId,
  result,
  sendContext,
}: {
  data: unknown;
  functionId: string;
  result: unknown;
  sendContext: unknown;
}) {
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

async function fetchCacheResponse(functionId: string, data: unknown, signal?: AbortSignal | null) {
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
    if (process.env.NODE_ENV === "production" && typeof document !== "undefined") {
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
      const runtimeResponse = response as typeof response & { result: unknown };
      const runtimeContext = context as typeof context & { sendContext: unknown };
      await writeCacheItem({
        data: context.data,
        functionId: context.serverFnMeta.id,
        result: runtimeResponse.result,
        sendContext: runtimeContext.sendContext,
      });
    }

    return response;
  });
