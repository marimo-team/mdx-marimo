import {
  resolveTheme,
  themeAttributeFilter,
  themeModeFromHost,
  type MarimoThemeMode,
} from "./theme-mode";
import { applyMarimoShadowTheme, installMarimoShadowThemeBridge } from "./shadow-roots";

export type { MarimoThemeMode } from "./theme-mode";

export function installMarimoThemeBridge(
  host: HTMLElement,
  options: { theme?: MarimoThemeMode } = {},
): () => void {
  const themeMode = options.theme ?? themeModeFromHost(host);
  applyMarimoTheme(host, themeMode);
  const cleanupShadowTheme = installMarimoShadowThemeBridge(host, () =>
    resolveTheme(themeMode, host),
  );

  const update = () => applyMarimoTheme(host, themeMode);
  const ancestorObserver = new MutationObserver(update);
  let ancestor: HTMLElement | null = host;
  while (ancestor) {
    ancestorObserver.observe(ancestor, {
      attributes: true,
      attributeFilter: themeAttributeFilter,
    });
    ancestor = ancestor.parentElement;
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", update);

  const timers = [0, 50, 250, 1000].map((delay) => window.setTimeout(update, delay));

  return () => {
    ancestorObserver.disconnect();
    media.removeEventListener("change", update);
    for (const timer of timers) window.clearTimeout(timer);
    cleanupShadowTheme();
    delete host.dataset.marimoTheme;
  };
}

export function applyMarimoTheme(
  host: HTMLElement,
  themeMode: MarimoThemeMode = themeModeFromHost(host),
): void {
  const theme = resolveTheme(themeMode, host);
  host.dataset.marimoTheme = theme;
  applyMarimoShadowTheme(host, theme);
}
