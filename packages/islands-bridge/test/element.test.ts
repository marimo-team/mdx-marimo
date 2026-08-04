import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { mountMarimoIsland, reconnectMarimoIsland } from "../src/browser/island";
import {
  defineMarimoIslandElement,
  mountMarimoIslandElement,
  type MarimoIslandElement,
} from "../src/element";
import {
  encodePageCellPayload,
  MARIMO_PAGE_PROTOCOL_VERSION,
  pageCellReferencePayload,
  pageCellPayload,
  type CompiledMarimoCell,
  type CompiledMarimoPage,
  type MarimoPageSerializedCellPayload,
} from "../src/protocol";

vi.mock("../src/browser/island", () => ({
  assertCurrentDocument: vi.fn(),
  mountMarimoIsland: vi.fn(() => vi.fn()),
  reconnectMarimoIsland: vi.fn(),
  renderMarimoIslandError: vi.fn(),
}));

const originalCustomElements = Object.getOwnPropertyDescriptor(globalThis, "customElements");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
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
  });

  it("hydrates a referenced cell after its page app connects", async () => {
    const constructor = installPayloadElement("marimo-reference-test");
    const page = compiledPage();
    const referenced = new constructor() as PayloadElement;
    const declaration = new constructor() as PayloadElement;
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));

    connectElement(referenced);
    await flushMicrotasks();

    const mount = vi.mocked(mountMarimoIsland);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0]![1]).toMatchObject({ app: null, cell: { index: 1 } });

    connectElement(declaration);
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledTimes(3);
    expect(mount.mock.calls.slice(1).map((call) => call[1])).toMatchObject([
      { app: { id: "marimo-reference-app" }, cell: { index: 0 } },
      { app: { id: "marimo-reference-app" }, cell: { index: 1 } },
    ]);

    disconnectElement(referenced);
    disconnectElement(declaration);
    await flushTasks();
  });

  it("resolves page references across bridge module instances", async () => {
    const ownerDocument = {} as Document;
    const firstBridge = await import("../src/element");
    const firstConstructor = installPayloadElement(
      "marimo-cross-module-carrier-test",
      firstBridge.defineMarimoIslandElement,
      ownerDocument,
    );
    const page = compiledPage("marimo-cross-module-app");
    const declaration = new firstConstructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    connectElement(declaration);
    await flushMicrotasks();

    vi.resetModules();
    const secondBridge = await import("../src/element");
    const secondConstructor = installPayloadElement(
      "marimo-cross-module-reference-test",
      secondBridge.defineMarimoIslandElement,
      ownerDocument,
    );
    const referenced = new secondConstructor() as PayloadElement;
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(referenced);
    await flushMicrotasks();

    expect(vi.mocked(mountMarimoIsland).mock.calls.at(-1)?.[1]).toMatchObject({
      app: { id: "marimo-cross-module-app" },
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    disconnectElement(declaration);
    await flushTasks();
  });

  it("mounts a programmatic payload and replaces it through the element property", async () => {
    const constructor = installPayloadElement("marimo-property-test");
    const page = compiledPage("marimo-property-app");
    const element = new constructor() as PayloadElement;

    element.payload = pageCellPayload(page, page.cells[0]!);
    connectElement(element);
    await flushMicrotasks();

    const mount = vi.mocked(mountMarimoIsland);
    expect(mount).toHaveBeenCalledOnce();
    expect(mount.mock.calls[0]![1]).toMatchObject({
      app: { id: "marimo-property-app" },
      cell: { index: 0 },
    });

    element.payload = pageCellPayload(page, page.cells[1]!);
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1]![1]).toMatchObject({
      app: { id: "marimo-property-app" },
      cell: { index: 1 },
    });
    disconnectElement(element);
    await flushTasks();
  });

  it("does not mount a queued payload after the element disconnects", async () => {
    const constructor = installPayloadElement("marimo-disconnected-test");
    const page = compiledPage("marimo-disconnected-app");
    const element = new constructor() as PayloadElement;
    setPayload(element, pageCellPayload(page, page.cells[0]!));

    connectElement(element);
    disconnectElement(element);
    await flushMicrotasks();

    expect(vi.mocked(mountMarimoIsland)).not.toHaveBeenCalled();
    await flushTasks();
  });

  it("rejects invalid programmatic payloads", () => {
    const constructor = installPayloadElement("marimo-invalid-property-test");
    const element = new constructor() as PayloadElement;

    expect(() => {
      element.payload = { protocolVersion: 1 } as never;
    }).toThrowError("Invalid marimo page cell payload");
  });

  it("keeps a page app resolvable while a referenced cell remains", async () => {
    const constructor = installPayloadElement("marimo-registration-test");
    const page = compiledPage("marimo-registration-app");
    const declaration = new constructor() as PayloadElement;
    const referenced = new constructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(declaration);
    connectElement(referenced);
    await flushMicrotasks();
    disconnectElement(declaration);
    await flushTasks();

    const mount = vi.mocked(mountMarimoIsland);
    mount.mockClear();
    const nextReference = new constructor() as PayloadElement;
    setPayload(nextReference, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(nextReference);
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledOnce();
    expect(mount.mock.calls[0]![1]).toMatchObject({
      app: { id: "marimo-registration-app" },
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    disconnectElement(nextReference);
    await flushTasks();
  });

  it("releases a page app when its declaration fails to mount", async () => {
    const constructor = installPayloadElement("marimo-failed-declaration-test");
    const page = compiledPage("marimo-failed-declaration-app");
    const declaration = new constructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    vi.mocked(mountMarimoIsland).mockImplementationOnce(() => {
      throw new Error("mount failed");
    });

    connectElement(declaration);
    await flushMicrotasks();

    const referenced = new constructor() as PayloadElement;
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(referenced);
    await flushMicrotasks();

    expect(vi.mocked(mountMarimoIsland).mock.calls.at(-1)?.[1]).toMatchObject({
      app: null,
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    disconnectElement(declaration);
  });

  it("resolves a reconnected reference from the current app owner", async () => {
    const constructor = installPayloadElement("marimo-reconnected-reference-test");
    const page = compiledPage("marimo-reconnected-reference-app");
    const declaration = new constructor() as PayloadElement;
    const referenced = new constructor() as PayloadElement;
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));

    connectElement(declaration);
    connectElement(referenced);
    await flushMicrotasks();

    disconnectElement(referenced);
    disconnectElement(declaration);
    await flushTasks();
    vi.mocked(mountMarimoIsland).mockClear();

    connectElement(referenced);
    await flushMicrotasks();

    expect(vi.mocked(mountMarimoIsland)).toHaveBeenCalledOnce();
    expect(vi.mocked(mountMarimoIsland).mock.calls[0]![1]).toMatchObject({
      app: null,
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    await flushTasks();
  });

  it("retains a mounted island when its element moves within one task", async () => {
    const constructor = installPayloadElement("marimo-relocation-test");
    const page = compiledPage("marimo-relocation-app");
    const element = new constructor() as PayloadElement;
    element.payload = pageCellPayload(page, page.cells[0]!);

    connectElement(element);
    await flushMicrotasks();
    const mount = vi.mocked(mountMarimoIsland);
    const cleanup = mount.mock.results[0]!.value;

    disconnectElement(element);
    connectElement(element);
    await flushTasks();
    await flushMicrotasks();

    expect(mount).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(reconnectMarimoIsland).toHaveBeenCalledOnce();

    disconnectElement(element);
    await flushTasks();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("mounts a replacement payload after reconnecting within one task", async () => {
    const constructor = installPayloadElement("marimo-relocation-replacement-test");
    const page = compiledPage("marimo-relocation-replacement-app");
    const element = new constructor() as PayloadElement;
    element.payload = pageCellPayload(page, page.cells[0]!);

    connectElement(element);
    await flushMicrotasks();
    const mount = vi.mocked(mountMarimoIsland);
    const firstCleanup = mount.mock.results[0]!.value;

    disconnectElement(element);
    element.payload = pageCellPayload(page, page.cells[1]!);
    connectElement(element);
    await flushMicrotasks();

    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1]![1]).toMatchObject({
      app: { id: "marimo-relocation-replacement-app" },
      cell: { index: 1 },
    });

    disconnectElement(element);
    await flushTasks();
  });
});

describe("mountMarimoIslandElement", () => {
  it("moves an equivalent retained island into a replacement host", () => {
    const constructor = installPayloadElement("marimo-retained-mount-test");
    const document = new TestDocument(constructor);
    const firstHost = new TestParent(document);
    const secondHost = new TestParent(document);
    const page = compiledPage("marimo-retained-mount-app");
    const payload = pageCellPayload(page, page.cells[0]!);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const first = mountMarimoIslandElement(firstHost as unknown as HTMLElement, payload, {
      name: "marimo-retained-mount-test",
      releaseDelayFrames: 2,
      theme: "light",
    });
    first.release();
    const second = mountMarimoIslandElement(
      secondHost as unknown as HTMLElement,
      structuredClone(payload),
      {
        name: "marimo-retained-mount-test",
        releaseDelayFrames: 2,
        theme: "dark",
      },
    );

    expect(second.element).toBe(first.element);
    expect(second.element.dataset.marimoThemeMode).toBe("dark");
    expect(secondHost.children).toEqual([first.element]);
    for (const frame of frames) frame(0);
    expect(secondHost.children).toEqual([first.element]);
  });

  it("replaces an island when its payload changes", () => {
    const constructor = installPayloadElement("marimo-revised-mount-test");
    const document = new TestDocument(constructor);
    const host = new TestParent(document);
    const page = compiledPage("marimo-revised-mount-app");

    const first = mountMarimoIslandElement(
      host as unknown as HTMLElement,
      pageCellPayload(page, page.cells[0]!),
      { name: "marimo-revised-mount-test" },
    );
    const second = mountMarimoIslandElement(
      host as unknown as HTMLElement,
      pageCellPayload(page, page.cells[1]!),
      { name: "marimo-revised-mount-test" },
    );

    expect(second.element).not.toBe(first.element);
    expect(host.children).toEqual([second.element]);
  });

  it("disposes a retained mount when its payload changes after disconnect", async () => {
    const constructor = installPayloadElement("marimo-retained-revision-test");
    const document = new TestDocument(constructor);
    const firstHost = new TestParent(document);
    const secondHost = new TestParent(document);
    const page = compiledPage("marimo-retained-revision-app");
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const first = mountMarimoIslandElement(
      firstHost as unknown as HTMLElement,
      pageCellPayload(page, page.cells[0]!),
      {
        name: "marimo-retained-revision-test",
        releaseDelayFrames: 2,
        retentionKey: "stable-slot",
      },
    );
    await flushMicrotasks();
    const cleanup = vi.mocked(mountMarimoIsland).mock.results.at(-1)?.value;
    first.release();
    firstHost.remove(first.element);
    await flushTasks();

    mountMarimoIslandElement(
      secondHost as unknown as HTMLElement,
      pageCellPayload(page, page.cells[1]!),
      {
        name: "marimo-retained-revision-test",
        releaseDelayFrames: 2,
        retentionKey: "stable-slot",
      },
    );

    expect(cleanup).toHaveBeenCalledOnce();
    for (const frame of frames) frame(0);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("adopts the requested retained cell when a wrapper already owns another cell", () => {
    const constructor = installPayloadElement("marimo-retained-swap-test");
    const document = new TestDocument(constructor);
    const firstHost = new TestParent(document);
    const secondHost = new TestParent(document);
    const page = compiledPage("marimo-retained-swap-app");
    const firstPayload = pageCellPayload(page, page.cells[0]!);
    const secondPayload = pageCellPayload(page, page.cells[1]!);
    const first = mountMarimoIslandElement(firstHost as unknown as HTMLElement, firstPayload, {
      name: "marimo-retained-swap-test",
    });
    const second = mountMarimoIslandElement(secondHost as unknown as HTMLElement, secondPayload, {
      name: "marimo-retained-swap-test",
    });

    const adopted = mountMarimoIslandElement(firstHost as unknown as HTMLElement, secondPayload, {
      name: "marimo-retained-swap-test",
    });

    expect(adopted.element).toBe(second.element);
    expect(adopted.element).not.toBe(first.element);
    expect(firstHost.children).toEqual([second.element]);
    expect(secondHost.children).toEqual([]);
  });

  it("does not retain an element under its previous app key", () => {
    const constructor = installPayloadElement("marimo-rekeyed-mount-test");
    const document = new TestDocument(constructor);
    const firstHost = new TestParent(document);
    const secondHost = new TestParent(document);
    const firstPage = compiledPage("first-app");
    const secondPage = compiledPage("second-app");

    const first = mountMarimoIslandElement(
      firstHost as unknown as HTMLElement,
      pageCellPayload(firstPage, firstPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );
    mountMarimoIslandElement(
      firstHost as unknown as HTMLElement,
      pageCellPayload(secondPage, secondPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );
    const remounted = mountMarimoIslandElement(
      secondHost as unknown as HTMLElement,
      pageCellPayload(firstPage, firstPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );

    expect(remounted.element).not.toBe(first.element);
  });
});

type PayloadElement = MarimoIslandElement & {
  connectedCallback: () => void;
  disconnectedCallback: () => void;
};

class TestPayloadElement {
  readonly attributes = new Map<string, string>();
  readonly classList = { add() {} };
  readonly dataset: Record<string, string> = {};
  ownerDocument = payloadOwnerDocument;
  isConnected = false;
  innerHTML = "";
  parentElement: TestParent | null = null;

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    this.parentElement?.remove(this as unknown as MarimoIslandElement);
  }
}

class TestDocument {
  constructor(private readonly elementConstructor: CustomElementConstructor) {}

  createElement(): HTMLElement {
    const element = new this.elementConstructor() as unknown as TestPayloadElement;
    element.ownerDocument = this as unknown as Document;
    return element as unknown as HTMLElement;
  }
}

class TestParent {
  readonly children: MarimoIslandElement[] = [];

  constructor(readonly ownerDocument: TestDocument) {}

  append(element: MarimoIslandElement): void {
    (element.parentElement as unknown as TestParent | null)?.remove(element);
    this.children.push(element);
    const payloadElement = element as unknown as TestPayloadElement;
    payloadElement.parentElement = this;
    payloadElement.isConnected = true;
    (element as PayloadElement).connectedCallback?.();
  }

  remove(element: MarimoIslandElement): void {
    const index = this.children.indexOf(element);
    if (index !== -1) this.children.splice(index, 1);
    const payloadElement = element as unknown as TestPayloadElement;
    payloadElement.parentElement = null;
    payloadElement.isConnected = false;
    (element as PayloadElement).disconnectedCallback?.();
  }
}

let payloadOwnerDocument = {} as Document;

function installPayloadElement(
  name: string,
  define = defineMarimoIslandElement,
  ownerDocument = {} as Document,
): CustomElementConstructor {
  payloadOwnerDocument = ownerDocument;
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

  return define({ name })!;
}

function setPayload(element: PayloadElement, payload: MarimoPageSerializedCellPayload): void {
  element.setAttribute("data-marimo-payload", encodePageCellPayload(payload));
  element.setAttribute("data-marimo-payload-encoding", "base64url");
}

function connectElement(element: PayloadElement): void {
  (element as unknown as TestPayloadElement).isConnected = true;
  element.connectedCallback();
}

function disconnectElement(element: PayloadElement): void {
  (element as unknown as TestPayloadElement).isConnected = false;
  element.disconnectedCallback();
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    output: null,
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
