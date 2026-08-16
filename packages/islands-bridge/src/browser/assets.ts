import type { MarimoRuntimeAssets, MarimoPageRuntime } from "../protocol";

type MarimoIslandModule = {
  initialize?: () => Promise<void> | void;
  canReplaceApp?: () => boolean;
  stopApp?: (appId?: string) => Promise<void> | void;
};

type MarimoAssetsLease = {
  activate: () => Promise<boolean>;
  ready: Promise<boolean>;
  release: () => void;
};

type RuntimeAssetHost = {
  readonly isConnected: boolean;
};

type AppLease = {
  host: RuntimeAssetHost;
  revision: string;
};

type AppRevision = {
  notebookCode: string | undefined;
  revision: string;
  runtimeCellCount: number;
};

type AppAssetsState = {
  leases: Set<AppLease>;
  modules?: MarimoIslandModule[];
};

type ActiveApp = {
  app: MarimoPageRuntime;
  hosts: RuntimeAssetHost[];
  replaceable: boolean;
  revision: string;
  state: AppAssetsState;
};

type RuntimeDocumentState = {
  activeApp?: ActiveApp;
  activation?: Promise<void>;
  appAssets: Map<string, AppAssetsState>;
  firstInitializedAppId?: string;
  key?: string;
  loadedModules: Map<string, Promise<MarimoIslandModule>>;
  reload?: Promise<never>;
  resolvedModules: Map<string, MarimoIslandModule>;
};

type MarimoMountConfig = {
  version?: string;
};

type MarimoExportContext = {
  trusted: true;
  notebookCode?: string;
};

const runtimeStateSymbol: unique symbol = Symbol.for("@marimo-team/islands-bridge/runtime-state");

declare global {
  interface Window {
    [runtimeStateSymbol]?: RuntimeDocumentState;
    __MARIMO_MOUNT_CONFIG__?: MarimoMountConfig;
    __MARIMO_EXPORT_CONTEXT__?: MarimoExportContext;
  }
}

const safeSessionHandoffVersion = [0, 23, 16] as const;
const appRevisions = new WeakMap<MarimoPageRuntime, AppRevision>();

export function hasConfirmedSoftNavigationAssets(app: MarimoPageRuntime): boolean {
  if (!matchesRuntime(app.assets)) return false;
  const modules: MarimoIslandModule[] = [];
  for (const src of app.assets.moduleScripts) {
    const runtimeModule = runtimeDocumentState().resolvedModules.get(moduleHref(src));
    if (!runtimeModule) return false;
    modules.push(runtimeModule);
  }
  return supportsSoftNavigation(app, modules);
}

export function acquireAssets(app: MarimoPageRuntime, host: RuntimeAssetHost): MarimoAssetsLease {
  const reload = claimRuntime(app.assets);
  if (reload) return { activate: () => reload, ready: reload, release: () => {} };

  ensureMountConfig(app.assets);
  ensureHeadTags(app.assets.headTags ?? []);
  ensureLinks(app.assets.links);

  const documentState = runtimeDocumentState();
  const state = documentState.appAssets.get(app.id) ?? { leases: new Set<AppLease>() };
  const lease = { host, revision: appRevision(app) };
  state.leases.add(lease);
  documentState.appAssets.set(app.id, state);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    state.leases.delete(lease);
    void enqueueRuntimeActivation(async () => {
      if (liveHosts(state).length > 0) return;
      const activeApp = runtimeDocumentState().activeApp;
      if (activeApp?.state === state) {
        if (activeApp.replaceable) await deactivateApp(activeApp);
        return;
      }
      cleanupAppState(app.id, state);
    });
  };
  const activate = () =>
    activateApp(app, state).then((modules) => supportsSoftNavigation(app, modules));
  const ready = activate().catch((error) => {
    release();
    throw error;
  });

  return { activate, ready, release };
}

function runtimeDocumentState(): RuntimeDocumentState {
  return (window[runtimeStateSymbol] ??= {
    appAssets: new Map(),
    loadedModules: new Map(),
    resolvedModules: new Map(),
  });
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

  return reloadDocument();
}

function reloadDocument(): Promise<never> {
  const state = runtimeDocumentState();
  state.reload ??= new Promise<never>(() => {});
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
  return enqueueRuntimeActivation(async () => {
    let hosts = liveHosts(state, revision);
    if (hosts.length === 0) return state.modules ?? [];

    const documentState = runtimeDocumentState();
    const activeApp = documentState.activeApp;
    if (
      activeApp?.state === state &&
      activeApp.revision === revision &&
      sameHosts(activeApp.hosts, hosts)
    ) {
      return state.modules ?? [];
    }

    let modules = state.modules;
    if (activeApp) {
      modules ??= await loadModules(app.assets.moduleScripts);
      state.modules = modules;
      hosts = liveHosts(state, revision);
      if (hosts.length === 0) return modules;
      if (!supportsSoftNavigation(app, modules)) return await reloadDocument();
      await deactivateApp(activeApp);
      hosts = liveHosts(state, revision);
      if (hosts.length === 0) {
        cleanupAppState(app.id, state);
        return modules;
      }
    }

    const isFirstApp = documentState.firstInitializedAppId === undefined;
    documentState.firstInitializedAppId ??= app.id;
    ensureExportContext(app.notebookCode);
    try {
      modules ??= await loadModules(app.assets.moduleScripts);
    } catch (error) {
      cleanupInactiveApp(app.id, state);
      throw error;
    }
    state.modules = modules;

    hosts = liveHosts(state, revision);
    const softNavigation = supportsSoftNavigation(app, modules);
    if (hosts.length === 0) {
      if (isFirstApp) {
        if (!softNavigation) return await reloadDocument();
        await stopAppOrReload(modules);
      }
      cleanupInactiveApp(app.id, state);
      return modules;
    }

    const activationHosts = hosts;
    try {
      if (!isFirstApp || softNavigation) {
        await Promise.all(modules.map(async (runtimeModule) => runtimeModule.initialize?.()));
      }
    } catch (error) {
      if (softNavigation) await stopAppOrReload(modules);
      cleanupInactiveApp(app.id, state);
      throw error;
    }

    if (liveHosts(state, revision).length === 0) {
      if (!softNavigation) return await reloadDocument();
      await stopAppOrReload(modules);
      cleanupInactiveApp(app.id, state);
      return modules;
    }

    documentState.activeApp = {
      app,
      hosts: activationHosts,
      replaceable: softNavigation,
      revision,
      state,
    };
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
  const existing = appRevisions.get(app);
  if (
    existing?.runtimeCellCount === app.runtimeCellCount &&
    existing.notebookCode === app.notebookCode
  ) {
    return existing.revision;
  }
  const revision = JSON.stringify([app.runtimeCellCount, app.notebookCode ?? null]);
  const cached = {
    notebookCode: app.notebookCode,
    revision,
    runtimeCellCount: app.runtimeCellCount,
  };
  appRevisions.set(app, cached);
  // Share serialization within one cell-mount batch. Later lifecycle work must
  // observe mutations made to the public runtime payload.
  queueMicrotask(() => {
    if (appRevisions.get(app) === cached) appRevisions.delete(app);
  });
  return revision;
}

function liveHosts(state: AppAssetsState, revision?: string): RuntimeAssetHost[] {
  const hosts = new Set<RuntimeAssetHost>();
  for (const lease of state.leases) {
    if (revision !== undefined && lease.revision !== revision) continue;
    if (lease.host.isConnected === false) continue;
    hosts.add(lease.host);
  }
  return [...hosts];
}

function sameHosts(left: RuntimeAssetHost[], right: RuntimeAssetHost[]): boolean {
  if (left.length !== right.length) return false;
  const rightHosts = new Set(right);
  return left.every((host) => rightHosts.has(host));
}

async function deactivateApp(activeApp: ActiveApp): Promise<void> {
  await stopAppOrReload(activeApp.state.modules ?? [], activeApp.app.id);

  const documentState = runtimeDocumentState();
  if (documentState.activeApp === activeApp) delete documentState.activeApp;
  cleanupAppState(activeApp.app.id, activeApp.state);
  if (!documentState.activeApp) delete window.__MARIMO_EXPORT_CONTEXT__;
}

async function stopAppOrReload(modules: MarimoIslandModule[], appId?: string): Promise<void> {
  try {
    await Promise.all(modules.map(async (runtimeModule) => runtimeModule.stopApp?.(appId)));
  } catch (error) {
    console.error(`Failed to stop marimo app${appId ? ` ${appId}` : ""}`, error);
    return await reloadDocument();
  }
}

function cleanupInactiveApp(appId: string, state: AppAssetsState): void {
  if (!runtimeDocumentState().activeApp) delete window.__MARIMO_EXPORT_CONTEXT__;
  cleanupAppState(appId, state);
}

function cleanupAppState(appId: string, state: AppAssetsState): void {
  const documentState = runtimeDocumentState();
  if (
    state.leases.size === 0 &&
    documentState.activeApp?.state !== state &&
    documentState.appAssets.get(appId) === state
  ) {
    documentState.appAssets.delete(appId);
  }
}

function supportsSoftNavigation(app: MarimoPageRuntime, modules: MarimoIslandModule[]): boolean {
  if (!hasSafeSessionHandoff(app.assets.version)) return false;
  const runtimes = modules.filter((runtimeModule) => runtimeModule.initialize);
  return (
    runtimes.length > 0 &&
    runtimes.every(
      (runtimeModule) =>
        runtimeModule.canReplaceApp?.() === true && runtimeModule.stopApp !== undefined,
    )
  );
}

function hasSafeSessionHandoff(version: string | undefined): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.post\d+)?(?:\+\S+)?$/.exec(version ?? "");
  if (!match) return false;
  const current = match.slice(1, 4).map(Number);
  for (let index = 0; index < safeSessionHandoffVersion.length; index += 1) {
    const difference = (current[index] ?? 0) - (safeSessionHandoffVersion[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function ensureMountConfig(assets: MarimoRuntimeAssets): void {
  if (!assets.version) return;
  const mountConfig = window.__MARIMO_MOUNT_CONFIG__;
  if (mountConfig !== undefined) {
    mountConfig.version ??= assets.version;
  } else {
    window.__MARIMO_MOUNT_CONFIG__ = { version: assets.version };
  }
}

function ensureExportContext(notebookCode: string | undefined): void {
  if (
    window.__MARIMO_EXPORT_CONTEXT__?.trusted === true &&
    window.__MARIMO_EXPORT_CONTEXT__.notebookCode === notebookCode
  ) {
    return;
  }
  const context: MarimoExportContext = { trusted: true };
  if (notebookCode) context.notebookCode = notebookCode;
  window.__MARIMO_EXPORT_CONTEXT__ = context;
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

function loadModules(sources: string[]): Promise<MarimoIslandModule[]> {
  return Promise.all(sources.map(ensureModule));
}

function ensureModule(src: string): Promise<MarimoIslandModule> {
  const href = moduleHref(src);
  const state = runtimeDocumentState();
  const existing = state.loadedModules.get(href);
  if (existing) return existing;

  const promise = importRuntimeModule(href);
  void promise.then(
    (runtimeModule) => {
      state.resolvedModules.set(href, runtimeModule);
    },
    () => {
      state.loadedModules.delete(href);
    },
  );
  state.loadedModules.set(href, promise);
  return promise;
}

async function importRuntimeModule(href: string): Promise<MarimoIslandModule> {
  const namespace = await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    href
  );
  const runtimeModule: MarimoIslandModule = {};
  const initialize: unknown = Object.getOwnPropertyDescriptor(namespace, "initialize")?.value;
  if (initialize instanceof Function) {
    runtimeModule.initialize = async () => {
      await initialize();
    };
  }
  const canReplaceApp: unknown = Object.getOwnPropertyDescriptor(namespace, "canReplaceApp")?.value;
  if (canReplaceApp instanceof Function) {
    runtimeModule.canReplaceApp = () => canReplaceApp() === true;
  }
  const stopApp: unknown = Object.getOwnPropertyDescriptor(namespace, "stopApp")?.value;
  if (stopApp instanceof Function) {
    runtimeModule.stopApp = async (appId) => {
      await stopApp(appId);
    };
  }
  return runtimeModule;
}
