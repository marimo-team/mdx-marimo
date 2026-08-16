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
    };

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

  it("reloads browser history traversal while document navigation is retained", async () => {
    const { reload, removeWindowListener } = await installBrowserGlobals();
    const { retainDocumentNavigation } = await import("../src/browser/navigation");

    const release = retainDocumentNavigation();

    history.back();
    expect(reload).toHaveBeenCalledOnce();

    release();
    history.forward();
    expect(reload).toHaveBeenCalledOnce();
    expect(removeWindowListener).toHaveBeenCalledWith("popstate", expect.any(Function), true);
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
  type ClickEvent = {
    altKey: boolean;
    button: number;
    ctrlKey: boolean;
    defaultPrevented: boolean;
    metaKey: boolean;
    preventDefault: () => void;
    shiftKey: boolean;
    target: TestAnchor;
  };
  type PopstateEvent = {
    stopImmediatePropagation: () => void;
  };

  let click: ((event: ClickEvent) => void) | undefined;
  let popstate: ((event: PopstateEvent) => void) | undefined;
  const assign = vi.fn();
  const reload = vi.fn();
  const removeWindowListener = vi.fn((event: string, listener: (event: PopstateEvent) => void) => {
    if (event === "popstate" && popstate === listener) popstate = undefined;
  });
  const replace = vi.fn();
  const pushState = vi.fn();
  const replaceState = vi.fn();
  const traverseHistory = () => {
    popstate?.({ stopImmediatePropagation: vi.fn() });
  };

  vi.stubGlobal("Element", TestElement);
  vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  vi.stubGlobal("document", {
    addEventListener: vi.fn((event: string, listener: (event: ClickEvent) => void) => {
      if (event === "click") click = listener;
    }),
    baseURI: "http://example.test/docs/",
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn((event: string, listener: (event: PopstateEvent) => void) => {
      if (event === "popstate") popstate = listener;
    }),
    location: {
      assign,
      origin: "http://example.test",
      pathname: "/docs/",
      reload,
      replace,
      search: "",
    },
    removeEventListener: removeWindowListener,
  });
  vi.stubGlobal("history", {
    back: vi.fn(traverseHistory),
    forward: vi.fn(traverseHistory),
    pushState,
    replaceState,
  });

  return {
    assign,
    click: (event: ClickEvent) => {
      if (!click) throw new Error("click listener was not installed");
      click(event);
    },
    pushState,
    reload,
    removeWindowListener,
    replace,
    replaceState,
  };
}
