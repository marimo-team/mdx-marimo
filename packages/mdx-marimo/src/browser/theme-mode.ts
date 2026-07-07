export type MarimoThemeMode = "auto" | "light" | "dark";
export type ResolvedMarimoTheme = "light" | "dark";

const themeDataAttributes = ["data-theme", "data-color-mode", "data-mode"];

export const themeAttributeFilter = ["class", "style", ...themeDataAttributes];

export function themeModeFromHost(host: HTMLElement): MarimoThemeMode {
  return normalizeThemeMode(host.getAttribute("data-marimo-theme-mode")) ?? "auto";
}

export function resolveTheme(themeMode: MarimoThemeMode): ResolvedMarimoTheme {
  return themeMode === "auto" ? currentTheme() : themeMode;
}

function currentTheme(): ResolvedMarimoTheme {
  const root = document.documentElement;
  const body = document.body;
  const classTheme = themeFromClasses(root) ?? themeFromClasses(body);
  if (classTheme) return classTheme;

  const attributeTheme = themeFromAttributes(root) ?? themeFromAttributes(body);
  if (attributeTheme) return attributeTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function themeFromClasses(element: Element): ResolvedMarimoTheme | undefined {
  if (element.classList.contains("dark")) return "dark";
  if (element.classList.contains("light")) return "light";
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
