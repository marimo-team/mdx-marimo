import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  applyMarimoShadowTheme,
  installMarimoShadowThemeBridge,
} from "../src/browser/shadow-roots";
import { installMarimoThemeBridge, refreshMarimoThemeBridge } from "../src/browser/theme";
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

  it("lets a host resolver define its automatic theme signal", () => {
    const host = themeElement();
    vi.stubGlobal("document", { body: host });

    expect(resolveTheme("auto", host, () => "dark")).toBe("dark");
    expect(resolveTheme("light", host, () => "dark")).toBe("light");
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

  it("tracks changes to an automatic host theme", () => {
    const { callbacks, host } = installThemeBrowser("light");
    const cleanup = installMarimoThemeBridge(host, { theme: "auto" });

    expect(host.dataset.marimoTheme).toBe("light");
    host.setAttribute("data-marimo-theme-mode", "dark");
    for (const callback of callbacks) callback([], {} as MutationObserver);

    expect(host.dataset.marimoTheme).toBe("dark");
    cleanup();
  });

  it("keeps an explicit theme fixed", () => {
    const { callbacks, host } = installThemeBrowser("light");
    const cleanup = installMarimoThemeBridge(host, { theme: "light" });

    host.setAttribute("data-marimo-theme-mode", "dark");
    for (const callback of callbacks) callback([], {} as MutationObserver);

    expect(host.dataset.marimoTheme).toBe("light");
    cleanup();
  });

  it("rebinds automatic theme observation after the host moves", () => {
    const lightParent = themeElement({ classes: ["light"] });
    const darkParent = themeElement({ classes: ["dark"] });
    const { host, observed } = installThemeBrowser("auto");
    Object.assign(host, { parentElement: lightParent });
    const cleanup = installMarimoThemeBridge(host, { theme: "auto" });
    expect(host.dataset.marimoTheme).toBe("light");

    Object.assign(host, { parentElement: darkParent });
    refreshMarimoThemeBridge(host);

    expect(host.dataset.marimoTheme).toBe("dark");
    expect(observed).toContain(darkParent);
    cleanup();
  });

  it("keeps a newer theme bridge active after stale cleanup", () => {
    const lightParent = themeElement({ classes: ["light"] });
    const darkParent = themeElement({ classes: ["dark"] });
    const { host } = installThemeBrowser("auto");
    Object.assign(host, { parentElement: lightParent });
    const staleCleanup = installMarimoThemeBridge(host, { theme: "auto" });
    const cleanup = installMarimoThemeBridge(host, { theme: "auto" });

    staleCleanup();
    expect(host.dataset.marimoTheme).toBe("light");
    Object.assign(host, { parentElement: darkParent });
    refreshMarimoThemeBridge(host);

    expect(host.dataset.marimoTheme).toBe("dark");
    cleanup();
  });

  it("stops observing shadow roots removed from the island", () => {
    const observers: TestObserver[] = [];
    const rootsByParent = new Map<ParentNode, Element[]>();
    const ownerDocument = {
      createElement: () => ({ id: "", textContent: "" }),
      createTreeWalker: (root: ParentNode) => {
        const elements = rootsByParent.get(root) ?? [];
        let index = 0;
        return { nextNode: () => elements[index++] ?? null };
      },
    } as unknown as Document;
    const firstRoot = testShadowRoot(ownerDocument);
    const secondRoot = testShadowRoot(ownerDocument);
    const firstHost = testShadowHost(firstRoot);
    const secondHost = testShadowHost(secondRoot);
    const host = {
      ...themeElement(),
      ownerDocument,
    } as unknown as HTMLElement;
    rootsByParent.set(host, [firstHost]);
    rootsByParent.set(firstRoot, []);
    rootsByParent.set(secondRoot, []);

    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal(
      "MutationObserver",
      class {
        readonly observer: TestObserver;

        constructor(callback: MutationCallback) {
          this.observer = new TestObserver(callback);
          observers.push(this.observer);
        }

        observe(target: Node) {
          this.observer.target = target;
        }

        disconnect() {
          this.observer.disconnected = true;
        }
      },
    );
    vi.stubGlobal("NodeFilter", { SHOW_ELEMENT: 1 });
    vi.stubGlobal("window", {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 0),
    });

    const cleanup = installMarimoShadowThemeBridge(host, () => "light");
    rootsByParent.set(host, [secondHost]);
    observers.find((observer) => observer.target === host)?.callback([], {} as MutationObserver);

    expect(observers.find((observer) => observer.target === firstRoot)?.disconnected).toBe(true);
    expect(observers.find((observer) => observer.target === secondRoot)?.disconnected).toBe(false);
    cleanup();
  });
});

class TestObserver {
  disconnected = false;
  target: Node | undefined;

  constructor(readonly callback: MutationCallback) {}
}

function testShadowRoot(ownerDocument: Document): ShadowRoot {
  return {
    append: () => {},
    ownerDocument,
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as ShadowRoot;
}

function testShadowHost(root: ShadowRoot): Element {
  const attributes = new Map<string, string>();
  return {
    classList: { add: () => {}, remove: () => {} },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    shadowRoot: root,
  } as unknown as Element;
}

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

function installThemeBrowser(mode: "auto" | "light" | "dark"): {
  callbacks: MutationCallback[];
  host: HTMLElement;
  observed: Node[];
} {
  const callbacks: MutationCallback[] = [];
  const observed: Node[] = [];
  const attributes = new Map<string, string>([["data-marimo-theme-mode", mode]]);
  const host = {
    classList: { contains: () => false },
    dataset: {} as Record<string, string>,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    parentElement: null,
  } as unknown as HTMLElement;

  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: MutationCallback) {
        callbacks.push(callback);
      }

      observe(target: Node) {
        observed.push(target);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("NodeFilter", { SHOW_ELEMENT: 1 });
  vi.stubGlobal("document", {
    body: host,
    createTreeWalker: () => ({ nextNode: () => null }),
  });
  vi.stubGlobal("window", {
    clearTimeout: vi.fn(),
    matchMedia: () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }),
    setTimeout: vi.fn(() => 0),
  });

  return { callbacks, host, observed };
}
