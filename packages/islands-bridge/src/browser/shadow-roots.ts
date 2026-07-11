import { SHADOW_THEME_CSS, SHADOW_THEME_STYLE_ID } from "../styling/shadow-theme";
import type { ResolvedMarimoTheme } from "./theme-mode";

type ShadowHost = Element & { shadowRoot: ShadowRoot };

export function installMarimoShadowThemeBridge(
  host: HTMLElement,
  resolveTheme: () => ResolvedMarimoTheme,
): () => void {
  const observedRoots = new WeakSet<ShadowRoot>();
  const observers: MutationObserver[] = [];

  const sync = () => {
    const theme = resolveTheme();
    applyMarimoShadowTheme(host, theme);

    for (const element of shadowHostsIn(host)) {
      const root = element.shadowRoot;
      if (observedRoots.has(root)) continue;

      observedRoots.add(root);
      const observer = new MutationObserver(sync);
      observer.observe(root, { childList: true, subtree: true });
      observers.push(observer);
    }
  };

  const hostObserver = new MutationObserver(sync);
  hostObserver.observe(host, { childList: true, subtree: true });
  observers.push(hostObserver);

  sync();

  const timers = [0, 50, 250, 1000].map((delay) => window.setTimeout(sync, delay));

  return () => {
    for (const observer of observers) observer.disconnect();
    for (const timer of timers) window.clearTimeout(timer);
  };
}

export function applyMarimoShadowTheme(host: HTMLElement, theme: ResolvedMarimoTheme): void {
  for (const element of shadowHostsIn(host)) {
    if (element.getAttribute("data-marimo-theme") !== theme) {
      element.setAttribute("data-marimo-theme", theme);
    }
    if (element instanceof HTMLElement) {
      element.style.colorScheme = theme;
    }
    ensureShadowThemeStyle(element.shadowRoot);
    applyShadowTheme(element.shadowRoot, theme);
  }
}

function shadowHostsIn(root: ParentNode): ShadowHost[] {
  const hosts: ShadowHost[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    const element = node as Element;
    if (element.shadowRoot) {
      hosts.push(element as ShadowHost);
      hosts.push(...shadowHostsIn(element.shadowRoot));
    }
    node = walker.nextNode();
  }

  return hosts;
}

function ensureShadowThemeStyle(root: ShadowRoot): void {
  const existing = root.querySelector(`style#${SHADOW_THEME_STYLE_ID}`);
  if (existing) {
    if (existing.nextSibling) root.append(existing);
    return;
  }

  const style = document.createElement("style");
  style.id = SHADOW_THEME_STYLE_ID;
  style.textContent = SHADOW_THEME_CSS;
  root.append(style);
}

function applyShadowTheme(root: ShadowRoot, theme: ResolvedMarimoTheme): void {
  const opposite = theme === "dark" ? "light" : "dark";
  for (const element of root.querySelectorAll(".contents, .markdown.prose")) {
    element.classList.add(theme);
    element.classList.remove(opposite);
    if (element.getAttribute("data-marimo-theme") !== theme) {
      element.setAttribute("data-marimo-theme", theme);
    }
  }
}
