import { afterEach, describe, expect, it, vi } from "vite-plus/test";

describe("document navigation", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("uses document navigation for anchor route changes", async () => {
    const { click, assign } = await installBrowserGlobals();
    const { retainDocumentNavigation } = await import("../src/browser/navigation");

    const release = retainDocumentNavigation();

    const event = {
      altKey: false,
      button: 0,
      ctrlKey: false,
      defaultPrevented: false,
      metaKey: false,
      preventDefault: vi.fn(),
      shiftKey: false,
      target: new TestAnchor("http://example.test/docs/fences"),
    } as unknown as MouseEvent;

    click(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("http://example.test/docs/fences");
    release();
  });

  it("uses document navigation for history route changes", async () => {
    const { assign, pushState } = await installBrowserGlobals();
    const { retainDocumentNavigation } = await import("../src/browser/navigation");

    const release = retainDocumentNavigation();
    history.pushState({}, "", "/docs/fences");

    expect(assign).toHaveBeenCalledWith("http://example.test/docs/fences");
    expect(pushState).not.toHaveBeenCalled();
    release();
  });

  it("keeps same-document hash changes in history", async () => {
    const { assign, pushState } = await installBrowserGlobals();
    const { retainDocumentNavigation } = await import("../src/browser/navigation");

    const release = retainDocumentNavigation();
    history.pushState({}, "", "#static-export");

    expect(assign).not.toHaveBeenCalled();
    expect(pushState).toHaveBeenCalledWith({}, "", "#static-export");
    release();
  });

  it("restores history after the final island unmounts", async () => {
    const { pushState } = await installBrowserGlobals();
    const { retainDocumentNavigation } = await import("../src/browser/navigation");

    const releaseFirst = retainDocumentNavigation();
    const releaseSecond = retainDocumentNavigation();
    releaseFirst();
    history.pushState({}, "", "/docs/fences");
    expect(pushState).not.toHaveBeenCalled();

    releaseSecond();
    history.pushState({}, "", "/docs/fences");
    expect(pushState).toHaveBeenCalledWith({}, "", "/docs/fences");
  });

  it("shares the navigation lease across bridge module instances", async () => {
    const { pushState } = await installBrowserGlobals();
    const firstBridge = await import("../src/browser/navigation");
    const releaseFirst = firstBridge.retainDocumentNavigation();

    vi.resetModules();
    const secondBridge = await import("../src/browser/navigation");
    const releaseSecond = secondBridge.retainDocumentNavigation();

    releaseFirst();
    history.pushState({}, "", "/docs/fences");
    expect(pushState).not.toHaveBeenCalled();

    releaseSecond();
    history.pushState({}, "", "/docs/fences");
    expect(pushState).toHaveBeenCalledWith({}, "", "/docs/fences");
  });
});

class TestElement {
  closest(): TestElement {
    return this;
  }
}

class TestAnchor extends TestElement {
  target = "";

  constructor(readonly href: string) {
    super();
  }

  hasAttribute(): boolean {
    return false;
  }
}

async function installBrowserGlobals() {
  let click: ((event: MouseEvent) => void) | undefined;
  const assign = vi.fn();
  const replace = vi.fn();
  const pushState = vi.fn();
  const replaceState = vi.fn();

  vi.stubGlobal("Element", TestElement);
  vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  vi.stubGlobal("document", {
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      if (event === "click") click = listener as (event: MouseEvent) => void;
    }),
    baseURI: "http://example.test/docs/",
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    location: {
      assign,
      origin: "http://example.test",
      pathname: "/docs/",
      replace,
      search: "",
    },
  });
  vi.stubGlobal("history", {
    pushState,
    replaceState,
  });

  return {
    assign,
    click: (event: MouseEvent) => {
      if (!click) throw new Error("click listener was not installed");
      click(event);
    },
    pushState,
    replace,
    replaceState,
  };
}
