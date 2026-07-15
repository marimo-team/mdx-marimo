import type { MarimoRuntimeAssets, MarimoPageRuntime } from "../protocol";

type MarimoIslandModule = {
  initialize?: () => Promise<void> | void;
  canReplaceApp?: () => boolean;
  stopApp?: (appId?: string) => Promise<void> | void;
};

export type MarimoAssetsLease = {
  release: () => void;
  supportsSoftNavigation: boolean;
};

type AppAssetsState = {
  active: boolean;
  activeRevision?: string;
  deactivation?: Promise<void>;
  modules?: MarimoIslandModule[];
  references: number;
};

type RuntimeDocumentState = {
  activeApp?: { appId: string; revision: string };
  activation?: Promise<void>;
  appAssets: Map<string, AppAssetsState>;
  firstInitializedAppId?: string;
  key?: string;
  reload?: Promise<never>;
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
const resolvedModules = new Map<string, MarimoIslandModule>();
const runtimeStateSymbol = Symbol.for("@marimo-team/islands-bridge/runtime-state");

export function hasConfirmedSoftNavigationAssets(app: MarimoPageRuntime): boolean {
  if (!matchesRuntime(app.assets)) return false;
  const modules: MarimoIslandModule[] = [];
  for (const src of app.assets.moduleScripts) {
    const runtimeModule = resolvedModules.get(moduleHref(src));
    if (!runtimeModule) return false;
    modules.push(runtimeModule);
  }
  return supportsSoftNavigation(modules);
}

export async function ensureAssets(app: MarimoPageRuntime): Promise<MarimoAssetsLease> {
  const { assets } = app;
  const reload = claimRuntime(assets);
  if (reload) return reload;
  ensureMountConfig(assets);
  ensureExportContext(app.notebookCode);
  ensureHeadTags(assets.headTags ?? []);
  ensureLinks(assets.links);

  const appAssets = runtimeDocumentState().appAssets;
  const state = appAssets.get(app.id) ?? {
    active: false,
    references: 0,
  };
  state.references += 1;
  appAssets.set(app.id, state);

  try {
    const modules = await activateApp(app, state);
    return createLease(app.id, state, modules);
  } catch (error) {
    state.references -= 1;
    if (state.references === 0 && !state.active && appAssets.get(app.id) === state) {
      appAssets.delete(app.id);
    }
    throw error;
  }
}

function runtimeDocumentState(): RuntimeDocumentState {
  const target = window as typeof window & {
    [key: symbol]: RuntimeDocumentState | undefined;
  };
  return (target[runtimeStateSymbol] ??= { appAssets: new Map() });
}

function runtimeKey(assets: MarimoRuntimeAssets): string {
  return JSON.stringify([assets.version ?? null, assets.moduleScripts.map(moduleHref)]);
}

function matchesRuntime(assets: MarimoRuntimeAssets): boolean {
  const state = runtimeDocumentState();
  return !state.reload && state.key !== undefined && state.key === runtimeKey(assets);
}

function claimRuntime(assets: MarimoRuntimeAssets): Promise<never> | undefined {
  const state = runtimeDocumentState();
  if (state.reload) return state.reload;

  const key = runtimeKey(assets);
  if (state.key === undefined) {
    state.key = key;
    return undefined;
  }
  if (state.key === key) return undefined;

  state.reload = new Promise<never>(() => {});
  window.location.reload();
  return state.reload;
}

function moduleHref(src: string): string {
  return new URL(src, document.baseURI).href;
}

async function activateApp(
  app: MarimoPageRuntime,
  state: AppAssetsState,
): Promise<MarimoIslandModule[]> {
  const revision = appRevision(app);
  const documentState = runtimeDocumentState();
  if (
    !documentState.activation &&
    state.active &&
    state.modules &&
    state.activeRevision === revision &&
    documentState.activeApp?.appId === app.id &&
    documentState.activeApp.revision === revision
  ) {
    return state.modules;
  }

  return enqueueRuntimeActivation(async () => {
    await state.deactivation;
    if (
      state.active &&
      state.modules &&
      state.activeRevision === revision &&
      documentState.activeApp?.appId === app.id &&
      documentState.activeApp.revision === revision
    ) {
      return state.modules;
    }

    const isFirstApp = documentState.firstInitializedAppId === undefined;
    documentState.firstInitializedAppId ??= app.id;
    const modules =
      state.modules ?? (await Promise.all(app.assets.moduleScripts.map(ensureModule)));
    state.modules = modules;

    const softNavigation = supportsSoftNavigation(modules);
    if (!isFirstApp || softNavigation) {
      state.active = false;
      delete state.activeRevision;
      delete documentState.activeApp;
      ensureExportContext(app.notebookCode);
      await Promise.all(modules.map(async (runtimeModule) => runtimeModule.initialize?.()));
    }
    state.active = true;
    state.activeRevision = revision;
    documentState.activeApp = { appId: app.id, revision };
    return modules;
  });
}

function enqueueRuntimeActivation<T>(operation: () => Promise<T>): Promise<T> {
  const state = runtimeDocumentState();
  const activation = (state.activation ?? Promise.resolve()).then(operation);
  const tail = activation.then(
    () => undefined,
    () => undefined,
  );
  state.activation = tail;
  void tail.then(() => {
    if (state.activation === tail) delete state.activation;
  });
  return activation;
}

function appRevision(app: MarimoPageRuntime): string {
  return JSON.stringify([
    app.runtimeCellCount,
    app.notebookCode ?? null,
    app.runtimePayload ?? null,
  ]);
}

function createLease(
  appId: string,
  state: AppAssetsState,
  modules: MarimoIslandModule[],
): MarimoAssetsLease {
  const appAssets = runtimeDocumentState().appAssets;
  const softNavigation = supportsSoftNavigation(modules);
  let released = false;
  return {
    supportsSoftNavigation: softNavigation,
    release: () => {
      if (released) return;
      released = true;
      state.references -= 1;
      if (state.references > 0 || !softNavigation) return;

      queueMicrotask(() => {
        if (state.references > 0 || !state.active) return;
        const revision = state.activeRevision;
        state.active = false;
        delete state.activeRevision;
        const documentState = runtimeDocumentState();
        if (
          documentState.activeApp?.appId === appId &&
          documentState.activeApp.revision === revision
        ) {
          delete documentState.activeApp;
        }
        state.deactivation = Promise.all(
          modules.map(async (runtimeModule) => runtimeModule.stopApp?.(appId)),
        )
          .then(() => undefined)
          .catch((error: unknown) => {
            console.error(`Failed to stop marimo app ${appId}`, error);
          })
          .finally(() => {
            delete state.deactivation;
            if (state.references === 0 && !state.active && appAssets.get(appId) === state) {
              appAssets.delete(appId);
            }
          });
      });
    },
  };
}

function supportsSoftNavigation(modules: MarimoIslandModule[]): boolean {
  const runtimes = modules.filter((runtimeModule) => runtimeModule.initialize);
  return (
    runtimes.length > 0 &&
    runtimes.every(
      (runtimeModule) =>
        runtimeModule.canReplaceApp?.() === true && typeof runtimeModule.stopApp === "function",
    )
  );
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
  const href = moduleHref(src);
  const existing = loadedModules.get(href);
  if (existing) return existing;

  const promise = import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    href
  ) as Promise<MarimoIslandModule>;
  void promise.then(
    (runtimeModule) => {
      resolvedModules.set(href, runtimeModule);
    },
    () => {
      loadedModules.delete(href);
    },
  );
  loadedModules.set(href, promise);
  return promise;
}
