import type { MarimoOutput } from "../schema";
import { ensureAssets } from "./assets";
import { ensureDocumentNavigation } from "./navigation";
import { applyMarimoTheme, installMarimoThemeBridge, type MarimoThemeMode } from "./theme";

export type MountMarimoIslandOptions = {
  theme?: MarimoThemeMode;
};

export function mountMarimoIsland(
  host: HTMLElement,
  output: MarimoOutput,
  options: MountMarimoIslandOptions = {},
): () => void {
  if (typeof document !== "undefined") ensureDocumentNavigation();

  const theme = options.theme ?? "auto";
  let active = true;

  host.classList.add("marimo-island-host");
  host.dataset.marimoHost = "mdx";
  host.dataset.marimoThemeMode = theme;
  host.dataset.marimoAppId = output.appId;
  host.dataset.marimoCellIndex = String(output.cellIndex);
  host.innerHTML = output.html;

  const cleanupTheme = installMarimoThemeBridge(host, { theme });

  if (output.assets) {
    ensureAssets(output.assets, output.appId)
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
    host.replaceChildren();
  };
}

export function renderMarimoIslandError(host: HTMLElement, error: unknown): void {
  const details = document.createElement("details");
  details.open = true;
  details.className = "marimo-mdx-error";
  const summary = document.createElement("summary");
  summary.textContent = "Failed to load marimo runtime";
  const pre = document.createElement("pre");
  pre.textContent = error instanceof Error ? error.message : String(error);
  details.append(summary, pre);
  host.append(details);
}
