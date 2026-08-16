import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MarimoIslandElement } from "../src/element";
import {
  createMarimoIslandElementBridge,
  type MarimoIslandElementRuntime,
} from "../src/element/bridge";
import {
  encodePageCellPayload,
  MARIMO_PAGE_PROTOCOL_VERSION,
  pageCellReferencePayload,
  pageCellPayload,
  type CompiledMarimoCell,
  type CompiledMarimoPage,
  type MarimoPageSerializedCellPayload,
} from "../src/protocol";

const assertCurrentDocument = vi.fn<MarimoIslandElementRuntime["assertCurrentDocument"]>();
const mountMarimoIsland = vi.fn<MarimoIslandElementRuntime["mount"]>(() => vi.fn());
const reconnectMarimoIsland = vi.fn<MarimoIslandElementRuntime["reconnect"]>();
const renderMarimoIslandError = vi.fn<MarimoIslandElementRuntime["renderError"]>();
const runtime = {
  assertCurrentDocument,
  mount: mountMarimoIsland,
  reconnect: reconnectMarimoIsland,
  renderError: renderMarimoIslandError,
} satisfies MarimoIslandElementRuntime;
const bridge = createMarimoIslandElementBridge(runtime);
const defineMarimoIslandElement = bridge.define;
const mountMarimoIslandElement = bridge.mount;

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
    if (!constructor) throw new Error("Expected a custom element constructor");
    const element = new constructor();

    expect(element).toBeInstanceOf(TestHTMLElement);
    expect(element).toBeInstanceOf(constructor);
  });

  it("hydrates a referenced cell after its page app connects", async () => {
    const constructor = installPayloadElement("marimo-reference-test");
    const page = compiledPage();
    const referenced = new constructor();
    const declaration = new constructor();
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));

    connectElement(referenced);
    await flushMicrotasks();

    const mount = mountMarimoIsland;
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
    const ownerDocument = elementDocument(new TestDocument());
    const firstModule = await import("../src/element/bridge");
    const firstBridge = firstModule.createMarimoIslandElementBridge(runtime);
    const firstConstructor = installPayloadElement(
      "marimo-cross-module-carrier-test",
      firstBridge.define,
      ownerDocument,
    );
    const page = compiledPage("marimo-cross-module-app");
    const declaration = new firstConstructor();
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    connectElement(declaration);
    await flushMicrotasks();

    vi.resetModules();
    const secondModule = await import("../src/element/bridge");
    const secondBridge = secondModule.createMarimoIslandElementBridge(runtime);
    const secondConstructor = installPayloadElement(
      "marimo-cross-module-reference-test",
      secondBridge.define,
      ownerDocument,
    );
    const referenced = new secondConstructor();
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(referenced);
    await flushMicrotasks();

    expect(mountMarimoIsland.mock.calls.at(-1)?.[1]).toMatchObject({
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
    const element = new constructor();

    element.payload = pageCellPayload(page, page.cells[0]!);
    connectElement(element);
    await flushMicrotasks();

    const mount = mountMarimoIsland;
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

  it("returns the assigned programmatic payload by reference", () => {
    const constructor = installPayloadElement("marimo-property-identity-test");
    const page = compiledPage("marimo-property-identity-app");
    const element = new constructor();
    const payload = pageCellPayload(page, page.cells[0]!);

    element.payload = payload;

    expect(element.payload).toBe(payload);
  });

  it("rejects a programmatic payload mutated before its queued mount", async () => {
    const constructor = installPayloadElement("marimo-mutated-property-test");
    const page = compiledPage("marimo-mutated-property-app");
    const element = new constructor();
    const payload = pageCellPayload(page, page.cells[0]!);
    element.payload = payload;
    connectElement(element);
    Reflect.set(payload, "protocolVersion", 999);

    await flushMicrotasks();

    expect(element.payload).toBe(payload);
    expect(mountMarimoIsland).not.toHaveBeenCalled();
    expect(renderMarimoIslandError).toHaveBeenCalledOnce();
    expect(renderMarimoIslandError.mock.calls[0]?.[1]).toEqual(
      new TypeError("Invalid marimo page cell payload"),
    );
    disconnectElement(element);
    await flushTasks();
  });

  it("adopts an equal payload reference without remounting the active island", async () => {
    const constructor = installPayloadElement("marimo-equal-property-test");
    const page = compiledPage("marimo-equal-property-app");
    const element = new constructor();
    const initialPayload = pageCellPayload(page, page.cells[0]!);
    const replacementPayload = structuredClone(initialPayload);
    element.payload = initialPayload;
    connectElement(element);
    await flushMicrotasks();
    const cleanup = mountMarimoIsland.mock.results[0]!.value;

    element.payload = replacementPayload;
    await flushMicrotasks();

    expect(element.payload).toBe(replacementPayload);
    expect(mountMarimoIsland).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();

    disconnectElement(element);
    await flushTasks();
    connectElement(element);
    await flushMicrotasks();

    expect(mountMarimoIsland).toHaveBeenCalledTimes(2);
    expect(mountMarimoIsland.mock.calls[1]![1]).toBe(replacementPayload);
    disconnectElement(element);
    await flushTasks();
  });

  it("observes markup payloads when MutationObserver becomes available before connection", async () => {
    vi.stubGlobal("MutationObserver", undefined);
    const constructor = installPayloadElement("marimo-late-observer-test");
    const observe = vi.fn();
    let notifyMutation: ((mutations: TestMutation[]) => void) | undefined;

    class TestMutationObserver {
      constructor(callback: () => void) {
        notifyMutation = (mutations) => {
          if (mutations.length > 0) callback();
        };
      }

      disconnect(): void {}

      observe(target: Node, options?: MutationObserverInit): void {
        observe(target, options);
      }

      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    vi.stubGlobal("MutationObserver", TestMutationObserver);
    vi.stubGlobal("HTMLTemplateElement", class TestHTMLTemplateElement {});
    const page = compiledPage("marimo-late-observer-app");
    const element = new constructor();
    connectElement(element);
    await flushMicrotasks();

    expect(observe).toHaveBeenCalledOnce();
    expect(observe.mock.calls[0]?.[0]).toBe(element);
    expect(observe.mock.calls[0]?.[1]).toEqual({
      attributeFilter: ["data-marimo-payload", "data-marimo-payload-encoding"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    setPayload(element, pageCellPayload(page, page.cells[0]!));
    notifyMutation?.([
      { attributeName: "data-marimo-payload", type: "attributes" },
      { attributeName: "data-marimo-payload-encoding", type: "attributes" },
    ]);
    await flushMicrotasks();

    expect(mountMarimoIsland).toHaveBeenCalledOnce();
    disconnectElement(element);
    await flushTasks();
  });

  it("does not mount a queued payload after the element disconnects", async () => {
    const constructor = installPayloadElement("marimo-disconnected-test");
    const page = compiledPage("marimo-disconnected-app");
    const element = new constructor();
    setPayload(element, pageCellPayload(page, page.cells[0]!));

    connectElement(element);
    disconnectElement(element);
    await flushMicrotasks();

    expect(mountMarimoIsland).not.toHaveBeenCalled();
    await flushTasks();
  });

  it("rejects invalid programmatic payloads", () => {
    const constructor = installPayloadElement("marimo-invalid-property-test");
    const element = new constructor();

    expect(() => {
      Reflect.set(element, "payload", { protocolVersion: 1 });
    }).toThrowError(new TypeError("Invalid marimo page cell payload"));
  });

  it("reports invalid markup payloads as type errors", async () => {
    const constructor = installPayloadElement("marimo-invalid-markup-test");
    const element = new constructor();
    element.setAttribute("data-marimo-payload", JSON.stringify({ protocolVersion: 1 }));

    connectElement(element);
    await flushMicrotasks();

    expect(mountMarimoIsland).not.toHaveBeenCalled();
    expect(renderMarimoIslandError).toHaveBeenCalledOnce();
    expect(renderMarimoIslandError.mock.calls[0]?.[1]).toEqual(
      new TypeError("Invalid marimo page cell payload"),
    );
    disconnectElement(element);
    await flushTasks();
  });

  it("reports mount failures through the configured element runtime", async () => {
    const constructor = installPayloadElement("marimo-runtime-error-test");
    const page = compiledPage("marimo-runtime-error-app");
    const element = new constructor();
    const failure = new Error("mount failed");
    mountMarimoIsland.mockImplementationOnce(() => {
      throw failure;
    });
    element.payload = pageCellPayload(page, page.cells[0]!);

    connectElement(element);
    await flushMicrotasks();

    expect(renderMarimoIslandError).toHaveBeenCalledOnce();
    expect(renderMarimoIslandError.mock.calls[0]?.[0]).toBe(element);
    expect(renderMarimoIslandError.mock.calls[0]?.[1]).toBe(failure);
    disconnectElement(element);
    await flushTasks();
  });

  it("keeps a page app resolvable while a referenced cell remains", async () => {
    const constructor = installPayloadElement("marimo-registration-test");
    const page = compiledPage("marimo-registration-app");
    const declaration = new constructor();
    const referenced = new constructor();
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(declaration);
    connectElement(referenced);
    await flushMicrotasks();
    disconnectElement(declaration);
    await flushTasks();

    const mount = mountMarimoIsland;
    mount.mockClear();
    const nextReference = new constructor();
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
    const declaration = new constructor();
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    mountMarimoIsland.mockImplementationOnce(() => {
      throw new Error("mount failed");
    });

    connectElement(declaration);
    await flushMicrotasks();

    const referenced = new constructor();
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));
    connectElement(referenced);
    await flushMicrotasks();

    expect(mountMarimoIsland.mock.calls.at(-1)?.[1]).toMatchObject({
      app: null,
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    disconnectElement(declaration);
  });

  it("resolves a reconnected reference from the current app owner", async () => {
    const constructor = installPayloadElement("marimo-reconnected-reference-test");
    const page = compiledPage("marimo-reconnected-reference-app");
    const declaration = new constructor();
    const referenced = new constructor();
    setPayload(declaration, pageCellPayload(page, page.cells[0]!));
    setPayload(referenced, pageCellReferencePayload(page, page.cells[1]!));

    connectElement(declaration);
    connectElement(referenced);
    await flushMicrotasks();

    disconnectElement(referenced);
    disconnectElement(declaration);
    await flushTasks();
    mountMarimoIsland.mockClear();

    connectElement(referenced);
    await flushMicrotasks();

    expect(mountMarimoIsland).toHaveBeenCalledOnce();
    expect(mountMarimoIsland.mock.calls[0]![1]).toMatchObject({
      app: null,
      cell: { index: 1 },
    });

    disconnectElement(referenced);
    await flushTasks();
  });

  it("retains a mounted island when its element moves within one task", async () => {
    const constructor = installPayloadElement("marimo-relocation-test");
    const page = compiledPage("marimo-relocation-app");
    const element = new constructor();
    element.payload = pageCellPayload(page, page.cells[0]!);

    connectElement(element);
    await flushMicrotasks();
    const mount = mountMarimoIsland;
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
    const element = new constructor();
    element.payload = pageCellPayload(page, page.cells[0]!);

    connectElement(element);
    await flushMicrotasks();
    const mount = mountMarimoIsland;
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

    const first = mountMarimoIslandElement(elementHost(firstHost), payload, {
      name: "marimo-retained-mount-test",
      releaseDelayFrames: 2,
      theme: "light",
    });
    first.release();
    const second = mountMarimoIslandElement(elementHost(secondHost), structuredClone(payload), {
      name: "marimo-retained-mount-test",
      releaseDelayFrames: 2,
      theme: "dark",
    });

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
      elementHost(host),
      pageCellPayload(page, page.cells[0]!),
      { name: "marimo-revised-mount-test" },
    );
    const second = mountMarimoIslandElement(
      elementHost(host),
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
      elementHost(firstHost),
      pageCellPayload(page, page.cells[0]!),
      {
        name: "marimo-retained-revision-test",
        releaseDelayFrames: 2,
        retentionKey: "stable-slot",
      },
    );
    await flushMicrotasks();
    const cleanup = mountMarimoIsland.mock.results.at(-1)?.value;
    first.release();
    firstHost.remove(first.element);
    await flushTasks();

    mountMarimoIslandElement(elementHost(secondHost), pageCellPayload(page, page.cells[1]!), {
      name: "marimo-retained-revision-test",
      releaseDelayFrames: 2,
      retentionKey: "stable-slot",
    });

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
    const first = mountMarimoIslandElement(elementHost(firstHost), firstPayload, {
      name: "marimo-retained-swap-test",
    });
    const second = mountMarimoIslandElement(elementHost(secondHost), secondPayload, {
      name: "marimo-retained-swap-test",
    });

    const adopted = mountMarimoIslandElement(elementHost(firstHost), secondPayload, {
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
      elementHost(firstHost),
      pageCellPayload(firstPage, firstPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );
    mountMarimoIslandElement(
      elementHost(firstHost),
      pageCellPayload(secondPage, secondPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );
    const remounted = mountMarimoIslandElement(
      elementHost(secondHost),
      pageCellPayload(firstPage, firstPage.cells[0]!),
      { name: "marimo-rekeyed-mount-test" },
    );

    expect(remounted.element).not.toBe(first.element);
  });
});

type TestMutation = {
  attributeName: "data-marimo-payload" | "data-marimo-payload-encoding";
  type: "attributes";
};

type PayloadElement = MarimoIslandElement & {
  connectedCallback: () => void;
  disconnectedCallback: () => void;
  fixtureParent: () => TestParent | null;
  setFixtureConnected: (connected: boolean) => void;
  setFixtureDocument: (document: Document) => void;
  setFixtureParent: (parent: TestParent | null) => void;
};

type PayloadElementConstructor = new () => PayloadElement;

type ElementDocumentFixture = {
  createElement: (tagName: string) => HTMLElement;
};

type ElementHostFixture = {
  ownerDocument: Document;
  append: (element: MarimoIslandElement) => void;
};

class TestPayloadElement {
  readonly attributes = new Map<string, string>();
  readonly classList = { add() {} };
  readonly dataset: Record<string, string> = {};
  #ownerDocument = payloadOwnerDocument;
  #isConnected = false;
  #parent: TestParent | null = null;
  innerHTML = "";

  get isConnected(): boolean {
    return this.#isConnected;
  }

  get ownerDocument(): Document {
    return this.#ownerDocument;
  }

  get parentElement(): HTMLElement | null {
    return this.#parent ? elementHost(this.#parent) : null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelector(): Element | null {
    return null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    this.#parent?.removeFixture(this);
  }

  fixtureParent(): TestParent | null {
    return this.#parent;
  }

  setFixtureConnected(connected: boolean): void {
    this.#isConnected = connected;
  }

  setFixtureDocument(document: Document): void {
    this.#ownerDocument = document;
  }

  setFixtureParent(parent: TestParent | null): void {
    this.#parent = parent;
  }
}

class TestDocument {
  constructor(readonly elementConstructor?: PayloadElementConstructor) {}

  createElement(_tagName: string): HTMLElement {
    if (!this.elementConstructor) throw new Error("No custom element constructor was installed");
    const element = new this.elementConstructor();
    element.setFixtureDocument(elementDocument(this));
    return element;
  }
}

class TestParent {
  readonly children: MarimoIslandElement[] = [];
  readonly ownerDocument: Document;

  constructor(document: TestDocument) {
    this.ownerDocument = elementDocument(document);
  }

  append(element: MarimoIslandElement): void {
    const fixture = payloadElementFixture(element);
    fixture.fixtureParent()?.remove(element);
    this.children.push(element);
    fixture.setFixtureParent(this);
    fixture.setFixtureConnected(true);
    fixture.connectedCallback();
  }

  remove(element: MarimoIslandElement): void {
    this.#remove(element);
  }

  removeFixture(element: TestPayloadElement): void {
    this.#remove(element);
  }

  #remove(element: MarimoIslandElement | TestPayloadElement): void {
    const index = this.children.findIndex((child) => Object.is(child, element));
    if (index === -1) return;
    const mounted = this.children[index];
    if (!mounted) return;
    this.children.splice(index, 1);
    const fixture = payloadElementFixture(mounted);
    fixture.setFixtureParent(null);
    fixture.setFixtureConnected(false);
    fixture.disconnectedCallback();
  }
}

let payloadOwnerDocument: Document;

function installPayloadElement(
  name: string,
  define = defineMarimoIslandElement,
  ownerDocument = elementDocument(new TestDocument()),
): PayloadElementConstructor {
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

  const constructor = define({ name });
  if (!constructor) throw new Error("Expected a custom element constructor");
  // SAFETY: The platform base supplies the fixture controls and the registered
  // marimo constructor supplies the payload property and lifecycle callbacks.
  return constructor as PayloadElementConstructor;
}

function setPayload(element: PayloadElement, payload: MarimoPageSerializedCellPayload): void {
  element.setAttribute("data-marimo-payload", encodePageCellPayload(payload));
  element.setAttribute("data-marimo-payload-encoding", "base64url");
}

function connectElement(element: PayloadElement): void {
  element.setFixtureConnected(true);
  element.connectedCallback();
}

function disconnectElement(element: PayloadElement): void {
  element.setFixtureConnected(false);
  element.disconnectedCallback();
}

function elementDocument(document: ElementDocumentFixture): Document {
  // SAFETY: Element tests use the document for createElement and symbol-keyed
  // registries. The fixture implements createElement and remains extensible.
  return document as Document;
}

function elementHost(host: ElementHostFixture): HTMLElement {
  // SAFETY: mountMarimoIslandElement uses the host's ownerDocument, append
  // method, and symbol-keyed retention state, all implemented by the fixture.
  return host as HTMLElement;
}

function payloadElementFixture(element: MarimoIslandElement): PayloadElement {
  // SAFETY: TestDocument creates elements with the constructor returned by
  // installPayloadElement, which combines these fixture and marimo contracts.
  return element as PayloadElement;
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
