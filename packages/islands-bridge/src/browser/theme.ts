import {
  resolveTheme,
  themeAttributeFilter,
  themeModeFromHost,
  type MarimoThemeMode,
  type MarimoThemeResolver,
} from "./theme-mode";
import { applyMarimoShadowTheme, installMarimoShadowThemeBridge } from "./shadow-roots";

export type { MarimoThemeMode, MarimoThemeResolver } from "./theme-mode";

export type MarimoThemeBridgeOptions = {
  theme?: MarimoThemeMode;
  themeResolver?: MarimoThemeResolver;
};

const themeBridges = new WeakMap<HTMLElement, { refresh: () => void }>();

export function installMarimoThemeBridge(
  host: HTMLElement,
  options: MarimoThemeBridgeOptions = {},
): () => void {
  const themeMode = () =>
    options.theme === undefined || options.theme === "auto"
      ? themeModeFromHost(host)
      : options.theme;
  const cleanupShadowTheme = installMarimoShadowThemeBridge(host, () =>
    resolveTheme(themeMode(), host, options.themeResolver),
  );

  const update = () => applyMarimoTheme(host, themeMode(), options.themeResolver);
  const ancestorObserver = new MutationObserver(update);
  const refresh = () => {
    ancestorObserver.disconnect();
    let ancestor: HTMLElement | null = host;
    while (ancestor) {
      ancestorObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: themeAttributeFilter,
      });
      ancestor = ancestor.parentElement;
    }
    update();
  };
  refresh();
  const bridge = { refresh };
  themeBridges.set(host, bridge);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", update);

  const timers = [0, 50, 250, 1000].map((delay) => window.setTimeout(update, delay));

  return () => {
    const registered = themeBridges.get(host) === bridge;
    if (registered) themeBridges.delete(host);
    ancestorObserver.disconnect();
    media.removeEventListener("change", update);
    for (const timer of timers) window.clearTimeout(timer);
    cleanupShadowTheme();
    if (registered) delete host.dataset.marimoTheme;
  };
}

export function refreshMarimoThemeBridge(host: HTMLElement): void {
  themeBridges.get(host)?.refresh();
}

export function applyMarimoTheme(
  host: HTMLElement,
  themeMode: MarimoThemeMode = themeModeFromHost(host),
  themeResolver?: MarimoThemeResolver,
): void {
  const theme = resolveTheme(themeMode, host, themeResolver);
  host.dataset.marimoTheme = theme;
  applyMarimoShadowTheme(host, theme);
}
