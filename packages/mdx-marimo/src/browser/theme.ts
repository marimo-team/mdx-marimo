import {
  resolveTheme,
  themeAttributeFilter,
  themeModeFromHost,
  type MarimoThemeMode,
} from "./theme-mode";
import { applyMarimoShadowTheme } from "./shadow-roots";

export type { MarimoThemeMode } from "./theme-mode";

export function installMarimoThemeBridge(
  host: HTMLElement,
  options: { theme?: MarimoThemeMode } = {},
): () => void {
  const themeMode = options.theme ?? themeModeFromHost(host);
  applyMarimoTheme(host, themeMode);

  const update = () => applyMarimoTheme(host, themeMode);
  const htmlObserver = new MutationObserver(update);
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: themeAttributeFilter,
  });

  const bodyObserver = new MutationObserver(update);
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: themeAttributeFilter,
  });

  const subtreeObserver = new MutationObserver(update);
  subtreeObserver.observe(host, { childList: true, subtree: true });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", update);

  const timers = [0, 50, 250, 1000].map((delay) => window.setTimeout(update, delay));

  return () => {
    htmlObserver.disconnect();
    bodyObserver.disconnect();
    subtreeObserver.disconnect();
    media.removeEventListener("change", update);
    for (const timer of timers) window.clearTimeout(timer);
    delete host.dataset.marimoTheme;
  };
}

export function applyMarimoTheme(
  host: HTMLElement,
  themeMode: MarimoThemeMode = themeModeFromHost(host),
): void {
  const theme = resolveTheme(themeMode);
  host.dataset.marimoTheme = theme;
  applyMarimoShadowTheme(host, theme);
}
