import { SHADOW_THEME_CSS, SHADOW_THEME_STYLE_ID } from "../styling/shadow-theme";
import type { ResolvedMarimoTheme } from "./theme-mode";

type ShadowHost = {
  element: Element;
  root: ShadowRoot;
};

export function installMarimoShadowThemeBridge(
  host: HTMLElement,
  resolveTheme: () => ResolvedMarimoTheme,
): () => void {
  const observers = new Map<ShadowRoot, MutationObserver>();
  const ownerDocument = host.ownerDocument ?? document;

  const sync = () => {
    const theme = resolveTheme();
    applyMarimoShadowTheme(host, theme);

    const roots = new Set(shadowHostsIn(host, ownerDocument).map((shadowHost) => shadowHost.root));
    for (const [root, observer] of observers) {
      if (roots.has(root)) continue;
      observer.disconnect();
      observers.delete(root);
    }
    for (const root of roots) {
      if (observers.has(root)) continue;

      const observer = new MutationObserver(sync);
      observer.observe(root, { childList: true, subtree: true });
      observers.set(root, observer);
    }
  };

  const hostObserver = new MutationObserver(sync);
  hostObserver.observe(host, { childList: true, subtree: true });

  sync();

  const timers = [0, 50, 250, 1000].map((delay) => window.setTimeout(sync, delay));

  return () => {
    hostObserver.disconnect();
    for (const observer of observers.values()) observer.disconnect();
    observers.clear();
    for (const timer of timers) window.clearTimeout(timer);
  };
}

export function applyMarimoShadowTheme(host: HTMLElement, theme: ResolvedMarimoTheme): void {
  const ownerDocument = host.ownerDocument ?? document;
  for (const { element, root } of shadowHostsIn(host, ownerDocument)) {
    if (element.getAttribute("data-marimo-theme") !== theme) {
      element.setAttribute("data-marimo-theme", theme);
    }
    if (element instanceof HTMLElement) {
      element.style.colorScheme = theme;
    }
    ensureShadowThemeStyle(root);
    applyShadowTheme(root, theme);
  }
}

function shadowHostsIn(root: ParentNode, document: Document): ShadowHost[] {
  const hosts: ShadowHost[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    if (isElement(node) && node.shadowRoot) {
      hosts.push({ element: node, root: node.shadowRoot });
      hosts.push(...shadowHostsIn(node.shadowRoot, document));
    }
    node = walker.nextNode();
  }

  return hosts;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function ensureShadowThemeStyle(root: ShadowRoot): void {
  const existing = root.querySelector(`style#${SHADOW_THEME_STYLE_ID}`);
  if (existing) {
    if (existing.nextSibling) root.append(existing);
    return;
  }

  const style = root.ownerDocument.createElement("style");
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
