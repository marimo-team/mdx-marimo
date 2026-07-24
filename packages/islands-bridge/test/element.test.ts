import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { mountMarimoIsland } from "../src/browser/island";
import { defineMarimoIslandElement } from "../src/element";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  pageCellReferencePayload,
  pageCellPayload,
  type CompiledMarimoCell,
  type CompiledMarimoPage,
} from "../src/protocol";

vi.mock("../src/browser/island", () => ({
  mountMarimoIsland: vi.fn(() => vi.fn()),
  renderMarimoIslandError: vi.fn(),
}));

const originalCustomElements = Object.getOwnPropertyDescriptor(globalThis, "customElements");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");

afterEach(() => {
  vi.clearAllMocks();
  restoreGlobal("customElements", originalCustomElements);
  restoreGlobal("HTMLElement", originalHTMLElement);
});

describe("defineMarimoIslandElement", () => {
  it("creates a custom element through the platform constructor", () => {
    class TestHTMLElement {}
    const definitions = new Map<string, CustomElementConstructor>();
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: TestHTMLElement,
    });
    Object.defineProperty(globalThis, "customElements", {
      configurable: true,
      value: {
        define(name: string, constructor: CustomElementConstructor) {
          definitions.set(name, constructor);
        },
        get(name: string) {
          return definitions.get(name);
        },
      },
    });

    const constructor = defineMarimoIslandElement({ name: "marimo-constructor-test" });
    const element = new constructor!();

    expect(element).toBeInstanceOf(TestHTMLElement);
    expect(element).toBeInstanceOf(constructor!);
    expect(
      (constructor as CustomElementConstructor & { observedAttributes: string[] })
        .observedAttributes,
    ).toEqual(["data-marimo-theme-mode"]);
  });

  it("hydrates a referenced cell after its page app connects", async () => {
    const constructor = installPayloadElement("marimo-reference-test");
    const page = compiledPage();
    const referenced = new constructor() as PayloadElement;
    const declaration = new constructor() as PayloadElement;
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));

    referenced.connectedCallback();
    await flushMicrotasks();

    const mount = vi.mocked(mountMarimoIsland);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0]![1]).toMatchObject({ app: null, cell: { index: 1 } });

    declaration.connectedCallback();
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledTimes(3);
    expect(mount.mock.calls.slice(1).map((call) => call[1])).toMatchObject([
      { app: { id: "marimo-reference-app" }, cell: { index: 0 } },
      { app: { id: "marimo-reference-app" }, cell: { index: 1 } },
    ]);

    referenced.disconnectedCallback();
    declaration.disconnectedCallback();
  });

  it("scopes a registered page app to its declaration element", async () => {
    const constructor = installPayloadElement("marimo-registration-test");
    const page = compiledPage("marimo-registration-app");
    const declaration = new constructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    declaration.connectedCallback();
    await flushMicrotasks();
    declaration.disconnectedCallback();

    const mount = vi.mocked(mountMarimoIsland);
    mount.mockClear();
    const referenced = new constructor() as PayloadElement;
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    referenced.connectedCallback();
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0]![1]).toMatchObject({ app: null, cell: { index: 1 } });

    declaration.connectedCallback();
    await flushMicrotasks();
    expect(mount.mock.calls.slice(1).map((call) => call[1])).toMatchObject([
      { app: { id: "marimo-registration-app" }, cell: { index: 0 } },
      { app: { id: "marimo-registration-app" }, cell: { index: 1 } },
    ]);

    referenced.disconnectedCallback();
    declaration.disconnectedCallback();
  });

  it("resolves a reconnected reference from the current app owner", async () => {
    const constructor = installPayloadElement("marimo-reconnected-reference-test");
    const page = compiledPage("marimo-reconnected-reference-app");
    const declaration = new constructor() as PayloadElement;
    const referenced = new constructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));

    declaration.connectedCallback();
    referenced.connectedCallback();
    await flushMicrotasks();

    referenced.disconnectedCallback();
    declaration.disconnectedCallback();
    vi.mocked(mountMarimoIsland).mockClear();

    referenced.connectedCallback();
    await flushMicrotasks();

    expect(vi.mocked(mountMarimoIsland)).toHaveBeenCalledOnce();
    expect(vi.mocked(mountMarimoIsland).mock.calls[0]![1]).toMatchObject({
      app: null,
      cell: { index: 1 },
    });

    referenced.disconnectedCallback();
  });
});

type PayloadElement = HTMLElement & {
  connectedCallback: () => void;
  disconnectedCallback: () => void;
};

class TestPayloadElement {
  readonly attributes = new Map<string, string>();
  readonly isConnected = true;

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function installPayloadElement(name: string): CustomElementConstructor {
  const definitions = new Map<string, CustomElementConstructor>();
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: TestPayloadElement,
  });
  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    value: {
      define(elementName: string, constructor: CustomElementConstructor) {
        definitions.set(elementName, constructor);
      },
      get(elementName: string) {
        return definitions.get(elementName);
      },
    },
  });

  return defineMarimoIslandElement({ name })!;
}

function setPayload(element: PayloadElement, payload: unknown): void {
  element.setAttribute(
    "data-marimo-payload",
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
  );
  element.setAttribute("data-marimo-payload-encoding", "base64url");
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function compiledPage(id = "marimo-reference-app"): CompiledMarimoPage {
  const cells = [cell(0), cell(1)];
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: {
      id,
      runtimeCellCount: cells.length,
      assets: { links: [], moduleScripts: [] },
      notebookCode: "x = 1\nx + 1",
    },
    cells,
    diagnostics: [],
  };
}

function cell(index: number): CompiledMarimoCell {
  return {
    index,
    html: `<marimo-island data-cell-index="${index}"></marimo-island>`,
    options: {
      language: "python",
      render: {
        source: false,
        output: true,
        include: true,
        editor: false,
        error: true,
        serverOutput: true,
      },
      execution: { enabled: true },
      marimo: { disabled: false, unparsable: false },
    },
  };
}

function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}
