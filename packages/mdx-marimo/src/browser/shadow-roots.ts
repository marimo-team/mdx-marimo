import { SHADOW_THEME_CSS, SHADOW_THEME_STYLE_ID } from "../styling/shadow-theme";
import type { ResolvedMarimoTheme } from "./theme-mode";

type ShadowHost = Element & { shadowRoot: ShadowRoot };

export function applyMarimoShadowTheme(host: HTMLElement, theme: ResolvedMarimoTheme): void {
  for (const element of shadowHostsIn(host)) {
    element.setAttribute("data-marimo-theme", theme);
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
  if (root.querySelector(`style#${SHADOW_THEME_STYLE_ID}`)) return;

  const style = document.createElement("style");
  style.id = SHADOW_THEME_STYLE_ID;
  style.textContent = SHADOW_THEME_CSS;
  root.prepend(style);
}

function applyShadowTheme(root: ShadowRoot, theme: ResolvedMarimoTheme): void {
  const opposite = theme === "dark" ? "light" : "dark";
  for (const element of root.querySelectorAll(".contents")) {
    element.classList.add(theme);
    element.classList.remove(opposite);
    element.setAttribute("data-marimo-theme", theme);
  }
}
