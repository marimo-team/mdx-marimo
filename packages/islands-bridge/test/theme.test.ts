import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  applyMarimoShadowTheme,
  installMarimoShadowThemeBridge,
} from "../src/browser/shadow-roots";
import { installMarimoThemeBridge, refreshMarimoThemeBridge } from "../src/browser/theme";
import { resolveTheme } from "../src/browser/theme-mode";

beforeEach(() => {
  rootsByParent = new Map();
  shadowRootOwnerDocument = undefined;
  shadowHostRoot = undefined;
  themeElementOptions = {};
  vi.stubGlobal("Document", DocumentFixture);
  vi.stubGlobal("Element", ShadowHostFixture);
  vi.stubGlobal("HTMLElement", ThemeHTMLElementFixture);
  vi.stubGlobal("ShadowRoot", ShadowRootFixture);
});

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
    const host = themeElement({ style });
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
    for (const callback of callbacks) callback();

    expect(host.dataset.marimoTheme).toBe("dark");
    cleanup();
  });

  it("keeps an explicit theme fixed", () => {
    const { callbacks, host } = installThemeBrowser("light");
    const cleanup = installMarimoThemeBridge(host, { theme: "light" });

    host.setAttribute("data-marimo-theme-mode", "dark");
    for (const callback of callbacks) callback();

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
    expect(observed.includes(darkParent)).toBe(true);
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
    const ownerDocument = shadowDocument(rootsByParent);
    const firstRoot = testShadowRoot(ownerDocument);
    const secondRoot = testShadowRoot(ownerDocument);
    const firstHost = testShadowHost(firstRoot);
    const secondHost = testShadowHost(secondRoot);
    const host = themeElement({ ownerDocument });
    rootsByParent.set(host, [firstHost]);
    rootsByParent.set(firstRoot, []);
    rootsByParent.set(secondRoot, []);

    vi.stubGlobal(
      "MutationObserver",
      class {
        readonly observer: TestObserver;

        constructor(callback: () => void) {
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
    observers.find((observer) => observer.target === host)?.callback();

    expect(observers.find((observer) => observer.target === firstRoot)?.disconnected).toBe(true);
    expect(observers.find((observer) => observer.target === secondRoot)?.disconnected).toBe(false);
    cleanup();
  });
});

class TestObserver {
  disconnected = false;
  target: Node | undefined;

  constructor(readonly callback: () => void) {}
}

type ThemeElementOptions = {
  attributes?: Iterable<readonly [string, string]>;
  classes?: string[];
  ownerDocument?: Document;
  parent?: HTMLElement | null;
  style?: { colorScheme: string };
};

class ThemeElementFixture {
  readonly classList: { contains: (value: string) => boolean };
  readonly dataset: Record<string, string> = {};
  readonly ownerDocument: Document | undefined;
  parentElement: HTMLElement | null;
  readonly style: { colorScheme: string } | undefined;

  readonly #attributes: Map<string, string>;

  constructor(options: ThemeElementOptions) {
    const classes = options.classes ?? [];
    this.#attributes = new Map(options.attributes);
    this.classList = { contains: (value: string) => classes.includes(value) };
    this.ownerDocument = options.ownerDocument;
    this.parentElement = options.parent ?? null;
    this.style = options.style;
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

let rootsByParent = new Map<ParentNode, Element[]>();
let shadowRootOwnerDocument: Document | undefined;
let shadowHostRoot: ShadowRoot | undefined;
let themeElementOptions: ThemeElementOptions = {};

class DocumentFixture {
  createElement() {
    return { id: "", textContent: "" };
  }

  createTreeWalker(root: ParentNode) {
    const elements = rootsByParent.get(root) ?? [];
    let index = 0;
    return { nextNode: () => elements[index++] ?? null };
  }
}

class ShadowRootFixture {
  readonly ownerDocument = shadowRootOwnerDocument;

  append() {}
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
}

class ShadowHostFixture {
  readonly #attributes = new Map<string, string>();

  readonly classList = { add: () => {}, remove: () => {} };
  readonly nodeType = 1;
  readonly shadowRoot = shadowHostRoot;

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

class ThemeHTMLElementFixture extends ThemeElementFixture {
  constructor() {
    super(themeElementOptions);
  }
}

function shadowDocument(documentRoots: Map<ParentNode, Element[]>): Document {
  rootsByParent = documentRoots;
  return new Document();
}

function testShadowRoot(ownerDocument: Document): ShadowRoot {
  shadowRootOwnerDocument = ownerDocument;
  return new ShadowRoot();
}

function testShadowHost(root: ShadowRoot): Element {
  shadowHostRoot = root;
  return new Element();
}

function themeElement(options: ThemeElementOptions = {}): HTMLElement {
  themeElementOptions = options;
  return new HTMLElement();
}

function installThemeBrowser(mode: "auto" | "light" | "dark") {
  const callbacks: Array<() => void> = [];
  const observed: Node[] = [];
  const host = themeElement({ attributes: [["data-marimo-theme-mode", mode]] });

  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
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
  vi.stubGlobal("getComputedStyle", () => ({ colorScheme: "normal" }));
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
