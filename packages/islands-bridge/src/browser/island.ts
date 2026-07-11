import type { MarimoPageCellPayload } from "../protocol";
import { ensureAssets } from "./assets";
import { retainDocumentNavigation } from "./navigation";
import { applyMarimoTheme, installMarimoThemeBridge, type MarimoThemeMode } from "./theme";

export type MountMarimoIslandOptions = {
  host?: string;
  theme?: MarimoThemeMode;
};

export function mountMarimoIsland(
  host: HTMLElement,
  payload: MarimoPageCellPayload,
  options: MountMarimoIslandOptions = {},
): () => void {
  const releaseNavigation = retainDocumentNavigation();

  const theme = options.theme ?? "auto";
  let active = true;

  host.classList.add("marimo-island-host");
  if (options.host) host.dataset.marimoHost = options.host;
  host.dataset.marimoThemeMode = theme;
  if (payload.app) host.dataset.marimoAppId = payload.app.id;
  host.dataset.marimoCellIndex = String(payload.cell.index);
  host.innerHTML = payload.cell.html;

  const cleanupTheme = installMarimoThemeBridge(host, { theme });

  if (payload.app) {
    ensureAssets(payload.app)
      .then(() => {
        if (active) applyMarimoTheme(host, theme);
      })
      .catch((error: unknown) => {
        if (active) renderMarimoIslandError(host, error);
      });
  } else {
    applyMarimoTheme(host, theme);
  }

  return () => {
    active = false;
    cleanupTheme();
    releaseNavigation();
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
