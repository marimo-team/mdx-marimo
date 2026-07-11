import type { MarimoRuntimeAssets, MarimoPageRuntime } from "../protocol";

type MarimoIslandModule = {
  initialize?: () => Promise<void> | void;
};

type MarimoMountConfig = Record<string, unknown> & {
  version?: string;
};

declare global {
  interface Window {
    __MARIMO_MOUNT_CONFIG__?: MarimoMountConfig;
    __MARIMO_EXPORT_CONTEXT__?: {
      trusted: true;
      notebookCode?: string;
    };
  }
}

const loadedModules = new Map<string, Promise<MarimoIslandModule>>();
const initializedApps = new Set<string>();
let firstInitializedAppId: string | undefined;

export async function ensureAssets(app: MarimoPageRuntime): Promise<void> {
  const { assets } = app;
  ensureMountConfig(assets);
  ensureExportContext(app.notebookCode);
  ensureHeadTags(assets.headTags ?? []);
  ensureLinks(assets.links);
  const modules = await Promise.all(assets.moduleScripts.map(ensureModule));
  if (initializedApps.has(app.id)) return;
  initializedApps.add(app.id);
  if (firstInitializedAppId === undefined) {
    firstInitializedAppId = app.id;
    return;
  }
  await Promise.all(modules.map(async (runtimeModule) => runtimeModule.initialize?.()));
}

function ensureMountConfig(assets: MarimoRuntimeAssets): void {
  if (!assets.version) return;
  const mountConfig = window.__MARIMO_MOUNT_CONFIG__;
  if (mountConfig && typeof mountConfig === "object") {
    mountConfig.version ??= assets.version;
  } else {
    window.__MARIMO_MOUNT_CONFIG__ = { version: assets.version };
  }
}

function ensureExportContext(notebookCode: string | undefined): void {
  if (!notebookCode) return;
  if (
    window.__MARIMO_EXPORT_CONTEXT__?.trusted === true &&
    window.__MARIMO_EXPORT_CONTEXT__.notebookCode === notebookCode
  ) {
    return;
  }
  window.__MARIMO_EXPORT_CONTEXT__ = {
    trusted: true,
    notebookCode,
  };
}

function ensureHeadTags(tags: NonNullable<MarimoRuntimeAssets["headTags"]>): void {
  for (const tag of tags) {
    if (!tag.tag) continue;
    const existing = Array.from(document.head.querySelectorAll(tag.tag)).find((element) =>
      headTagMatches(element, tag),
    );
    if (existing) continue;

    const element = document.createElement(tag.tag);
    for (const [key, value] of Object.entries(tag.attrs)) {
      element.setAttribute(key, value);
    }
    if (tag.text) element.textContent = tag.text;
    document.head.append(element);
  }
}

function ensureLinks(links: MarimoRuntimeAssets["links"]): void {
  for (const attrs of links) {
    if (!attrs.href) continue;
    const href = new URL(attrs.href, document.baseURI).href;
    const rel = attrs.rel ?? "";
    const existing = Array.from(document.head.querySelectorAll("link[href]")).find(
      (link) =>
        link instanceof HTMLLinkElement &&
        link.href === href &&
        (link.getAttribute("rel") || "") === rel,
    );
    if (existing) continue;

    const link = document.createElement("link");
    for (const [key, value] of Object.entries(attrs)) {
      link.setAttribute(key, value);
    }
    link.href = href;
    document.head.append(link);
  }
}

function headTagMatches(
  element: Element,
  tag: NonNullable<MarimoRuntimeAssets["headTags"]>[number],
): boolean {
  const attrsMatch = Object.entries(tag.attrs).every(
    ([key, value]) => (element.getAttribute(key) || "") === value,
  );
  if (!attrsMatch) return false;
  return !tag.text || element.textContent === tag.text;
}

function ensureModule(src: string): Promise<MarimoIslandModule> {
  const href = new URL(src, document.baseURI).href;
  const existing = loadedModules.get(href);
  if (existing) return existing;

  const promise = import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    href
  ) as Promise<MarimoIslandModule>;
  loadedModules.set(href, promise);
  return promise;
}
