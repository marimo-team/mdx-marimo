import type { MarimoPageCellPayload } from "../protocol";
import { acquireAssets, hasConfirmedSoftNavigationAssets } from "./assets";
import { retainDocumentNavigation } from "./navigation";
import {
  applyMarimoTheme,
  installMarimoThemeBridge,
  refreshMarimoThemeBridge,
  type MarimoThemeMode,
  type MarimoThemeResolver,
} from "./theme";
import { themeModeFromHost } from "./theme-mode";

export type MountMarimoIslandOptions = {
  host?: string;
  theme?: MarimoThemeMode;
  themeResolver?: MarimoThemeResolver;
};

export type MarimoIslandMountDependencies = {
  acquireAssets: typeof acquireAssets;
  applyMarimoTheme: typeof applyMarimoTheme;
  hasConfirmedSoftNavigationAssets: typeof hasConfirmedSoftNavigationAssets;
  installMarimoThemeBridge: typeof installMarimoThemeBridge;
  refreshMarimoThemeBridge: typeof refreshMarimoThemeBridge;
  retainDocumentNavigation: typeof retainDocumentNavigation;
};

export type MarimoIslandMount = (
  host: HTMLElement,
  payload: MarimoPageCellPayload,
  options?: MountMarimoIslandOptions,
) => () => void;

type MarimoThemeBridgeOptions = {
  theme?: MarimoThemeMode;
  themeResolver?: MarimoThemeResolver;
};

type DocumentPlatform = {
  document?: Document;
};

const reconnectors = new WeakMap<HTMLElement, () => void>();
const browserDependencies: MarimoIslandMountDependencies = {
  acquireAssets,
  applyMarimoTheme,
  hasConfirmedSoftNavigationAssets,
  installMarimoThemeBridge,
  refreshMarimoThemeBridge,
  retainDocumentNavigation,
};
const mountWithBrowserDependencies = createMarimoIslandMount(browserDependencies);

export function assertCurrentDocument(host: { ownerDocument: Document }): void {
  const platform: DocumentPlatform = globalThis;
  if (platform.document && host.ownerDocument !== platform.document) {
    throw new Error("Marimo islands must be mounted in the current document");
  }
}

export function reconnectMarimoIsland(host: HTMLElement): void {
  reconnectors.get(host)?.();
}

export function mountMarimoIsland(
  host: HTMLElement,
  payload: MarimoPageCellPayload,
  options: MountMarimoIslandOptions = {},
): () => void {
  return mountWithBrowserDependencies(host, payload, options);
}

export function createMarimoIslandMount(
  dependencies: MarimoIslandMountDependencies,
): MarimoIslandMount {
  return (host, payload, options = {}) =>
    mountMarimoIslandWithDependencies(dependencies, host, payload, options);
}

function mountMarimoIslandWithDependencies(
  dependencies: MarimoIslandMountDependencies,
  host: HTMLElement,
  payload: MarimoPageCellPayload,
  options: MountMarimoIslandOptions = {},
): () => void {
  assertCurrentDocument(host);
  const initialTheme = options.theme ?? themeModeFromHost(host);
  const currentTheme = () =>
    options.theme === undefined || options.theme === "auto"
      ? themeModeFromHost(host)
      : options.theme;
  let active = true;
  let activateAssets: (() => Promise<boolean>) | undefined;
  let releaseAssets: (() => void) | undefined;
  let releaseNavigation: (() => void) | undefined;

  host.classList.add("marimo-island-host");
  if (options.host) host.dataset.marimoHost = options.host;
  host.dataset.marimoThemeMode = initialTheme;
  if (payload.app) {
    host.dataset.marimoAppId = payload.app.id;
  } else {
    delete host.dataset.marimoAppId;
  }
  host.dataset.marimoCellIndex = String(payload.cell.index);
  host.innerHTML = payload.cell.html;

  if (!payload.app || !dependencies.hasConfirmedSoftNavigationAssets(payload.app)) {
    releaseNavigation = dependencies.retainDocumentNavigation();
  }

  const themeOptions: MarimoThemeBridgeOptions = {};
  if (options.theme !== undefined) themeOptions.theme = options.theme;
  if (options.themeResolver) themeOptions.themeResolver = options.themeResolver;
  const cleanupTheme = dependencies.installMarimoThemeBridge(host, themeOptions);
  const handleActivation = (supportsSoftNavigation: boolean) => {
    if (!active) return;
    if (supportsSoftNavigation) {
      releaseNavigation?.();
      releaseNavigation = undefined;
    } else {
      releaseNavigation ??= dependencies.retainDocumentNavigation();
    }
    dependencies.applyMarimoTheme(host, currentTheme(), options.themeResolver);
  };

  if (payload.app) {
    try {
      const lease = dependencies.acquireAssets(payload.app, host);
      activateAssets = lease.activate;
      releaseAssets = lease.release;
      lease.ready.then(handleActivation).catch((cause: unknown) => {
        if (active) renderMarimoIslandError(host, cause);
      });
    } catch (cause: unknown) {
      renderMarimoIslandError(host, cause);
    }
  } else {
    dependencies.applyMarimoTheme(host, currentTheme(), options.themeResolver);
  }

  const reconnect = () => {
    if (!active) return;
    dependencies.refreshMarimoThemeBridge(host);
    void activateAssets?.()
      .then(handleActivation)
      .catch((cause: unknown) => {
        if (active) renderMarimoIslandError(host, cause);
      });
  };
  reconnectors.set(host, reconnect);

  return () => {
    active = false;
    if (reconnectors.get(host) === reconnect) reconnectors.delete(host);
    releaseAssets?.();
    cleanupTheme();
    releaseNavigation?.();
    host.replaceChildren();
  };
}

export function renderMarimoIslandError(host: HTMLElement, cause: unknown): void {
  const details = document.createElement("details");
  details.open = true;
  details.className = "marimo-island-error";
  const summary = document.createElement("summary");
  summary.textContent = "Failed to load marimo runtime";
  const pre = document.createElement("pre");
  pre.textContent = cause instanceof Error ? cause.message : String(cause);
  details.append(summary, pre);
  host.append(details);
}
