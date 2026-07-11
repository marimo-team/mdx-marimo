import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { applyMarimoShadowTheme } from "../src/browser/shadow-roots";
import { resolveTheme } from "../src/browser/theme-mode";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("automatic island theme", () => {
  it("keeps an unthemed light page light when the OS prefers dark", () => {
    const host = themeElement();
    vi.stubGlobal("document", { body: host });
    vi.stubGlobal("getComputedStyle", () => ({ colorScheme: "normal" }));
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });

    expect(resolveTheme("auto", host)).toBe("light");
  });

  it("uses the nearest explicit host theme", () => {
    const root = themeElement({ classes: ["dark"] });
    const host = themeElement({ parent: root });
    vi.stubGlobal("document", { body: root });

    expect(resolveTheme("auto", host)).toBe("dark");
  });

  it("leaves inherited color-scheme under host control", () => {
    const style = { colorScheme: "inherit" };
    const host = { ...themeElement(), style } as unknown as HTMLElement;
    vi.stubGlobal("NodeFilter", { SHOW_ELEMENT: 1 });
    vi.stubGlobal("document", {
      createTreeWalker: () => ({ nextNode: () => null }),
    });

    applyMarimoShadowTheme(host, "dark");

    expect(style.colorScheme).toBe("inherit");
  });
});

function themeElement({
  classes = [],
  parent = null,
}: {
  classes?: string[];
  parent?: HTMLElement | null;
} = {}): HTMLElement {
  return {
    classList: { contains: (value: string) => classes.includes(value) },
    getAttribute: () => null,
    parentElement: parent,
  } as unknown as HTMLElement;
}
