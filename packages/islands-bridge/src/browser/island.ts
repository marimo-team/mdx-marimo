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

const reconnectors = new WeakMap<HTMLElement, () => void>();

export function assertCurrentDocument(host: { ownerDocument: Document }): void {
  if (typeof document !== "undefined" && host.ownerDocument !== document) {
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

  if (!payload.app || !hasConfirmedSoftNavigationAssets(payload.app)) {
    releaseNavigation = retainDocumentNavigation();
  }

  const cleanupTheme = installMarimoThemeBridge(host, {
    ...(options.theme !== undefined ? { theme: options.theme } : {}),
    ...(options.themeResolver ? { themeResolver: options.themeResolver } : {}),
  });
  const handleActivation = (supportsSoftNavigation: boolean) => {
    if (!active) return;
    if (supportsSoftNavigation) {
      releaseNavigation?.();
      releaseNavigation = undefined;
    } else {
      releaseNavigation ??= retainDocumentNavigation();
    }
    applyMarimoTheme(host, currentTheme(), options.themeResolver);
  };

  if (payload.app) {
    try {
      const lease = acquireAssets(payload.app, host);
      activateAssets = lease.activate;
      releaseAssets = lease.release;
      lease.ready.then(handleActivation).catch((error: unknown) => {
        if (active) renderMarimoIslandError(host, error);
      });
    } catch (error: unknown) {
      renderMarimoIslandError(host, error);
    }
  } else {
    applyMarimoTheme(host, currentTheme(), options.themeResolver);
  }

  const reconnect = () => {
    if (!active) return;
    refreshMarimoThemeBridge(host);
    void activateAssets?.()
      .then(handleActivation)
      .catch((error: unknown) => {
        if (active) renderMarimoIslandError(host, error);
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

export function renderMarimoIslandError(host: HTMLElement, error: unknown): void {
  const details = document.createElement("details");
  details.open = true;
  details.className = "marimo-island-error";
  const summary = document.createElement("summary");
  summary.textContent = "Failed to load marimo runtime";
  const pre = document.createElement("pre");
  pre.textContent = error instanceof Error ? error.message : String(error);
  details.append(summary, pre);
  host.append(details);
}
