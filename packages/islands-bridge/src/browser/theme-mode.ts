export type MarimoThemeMode = "auto" | "light" | "dark";
export type ResolvedMarimoTheme = "light" | "dark";

const themeDataAttributes = ["data-theme", "data-color-mode", "data-mode"];

export const themeAttributeFilter = ["class", "style", ...themeDataAttributes];

export function themeModeFromHost(host: HTMLElement): MarimoThemeMode {
  return normalizeThemeMode(host.getAttribute("data-marimo-theme-mode")) ?? "auto";
}

export function resolveTheme(themeMode: MarimoThemeMode, host?: HTMLElement): ResolvedMarimoTheme {
  return themeMode === "auto" ? currentTheme(host) : themeMode;
}

function currentTheme(host: HTMLElement | undefined): ResolvedMarimoTheme {
  for (const element of themeAncestors(host)) {
    const explicitTheme = themeFromClasses(element) ?? themeFromAttributes(element);
    if (explicitTheme) return explicitTheme;
  }

  if (host && typeof getComputedStyle === "function") {
    const schemes = getComputedStyle(host).colorScheme.split(/\s+/);
    if (schemes.length === 1 && schemes[0] === "dark") return "dark";
    if (schemes.length === 1 && schemes[0] === "light") return "light";
    if (schemes.includes("dark") && schemes.includes("light")) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  }

  return "light";
}

function themeAncestors(host: HTMLElement | undefined): Element[] {
  const elements: Element[] = [];
  let element: Element | null = host ?? document.body;
  while (element) {
    elements.push(element);
    element = element.parentElement;
  }
  return elements;
}

function themeFromClasses(element: Element): ResolvedMarimoTheme | undefined {
  if (element.classList.contains("dark") || element.classList.contains("dark-theme")) return "dark";
  if (element.classList.contains("light") || element.classList.contains("light-theme"))
    return "light";
  return undefined;
}

function themeFromAttributes(element: Element): ResolvedMarimoTheme | undefined {
  for (const attribute of themeDataAttributes) {
    const theme = normalizeThemeMode(element.getAttribute(attribute));
    if (theme === "light" || theme === "dark") return theme;
  }
  return undefined;
}

function normalizeThemeMode(value: string | null | undefined): MarimoThemeMode | undefined {
  if (value === "auto" || value === "light" || value === "dark") return value;
  return undefined;
}
