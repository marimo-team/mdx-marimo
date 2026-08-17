import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createMarimoIslandMount,
  reconnectMarimoIsland,
  type MarimoIslandMount,
  type MarimoIslandMountDependencies,
} from "../src/browser/island";
import { MARIMO_PAGE_PROTOCOL_VERSION, type MarimoPageCellPayload } from "../src/protocol";

const testDocument = {};
type TestDependencies = ReturnType<typeof testDependencies>;

let dependencies: TestDependencies;
let mountIsland: MarimoIslandMount;

beforeEach(() => {
  vi.stubGlobal("document", testDocument);
  dependencies = testDependencies();
  mountIsland = createMarimoIslandMount(dependencies);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mountMarimoIsland", () => {
  it("mounts static HTML with host and theme metadata", () => {
    const host = testHost();
    const staticPayload = { ...payload(), app: null };

    const cleanup = mountIsland(host, staticPayload, {
      host: "publisher",
      theme: "dark",
    });

    expect(host.classList.add).toHaveBeenCalledWith("marimo-island-host");
    expect(host.dataset).toMatchObject({
      marimoCellIndex: "0",
      marimoHost: "publisher",
      marimoThemeMode: "dark",
    });
    expect(host.innerHTML).toBe(staticPayload.cell.html);
    expect(dependencies.applyMarimoTheme).toHaveBeenCalledWith(host, "dark", undefined);
    expect(dependencies.installMarimoThemeBridge).toHaveBeenCalledWith(host, {
      theme: "dark",
    });

    cleanup();
    expect(host.replaceChildren).toHaveBeenCalledOnce();
  });

  it("releases the document-navigation lease for a soft-navigation runtime", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    dependencies.retainDocumentNavigation.mockReturnValue(releaseNavigation);
    dependencies.acquireAssets.mockReturnValue(assetsLease(true, releaseAssets));

    const host = testHost();
    const cleanup = mountIsland(host, payload());
    await flushMicrotasks();

    expect(releaseNavigation).toHaveBeenCalledTimes(1);

    cleanup();
    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledOnce();
  });

  it("uses the current host theme after runtime assets load", async () => {
    const pending = deferred<boolean>();
    const releaseAssets = vi.fn();
    dependencies.acquireAssets.mockReturnValue(assetsLease(pending.promise, releaseAssets));
    const host = testHost();
    host.dataset.marimoThemeMode = "light";

    const cleanup = mountIsland(host, payload());
    host.dataset.marimoThemeMode = "dark";
    pending.resolve(true);
    await flushMicrotasks();

    expect(dependencies.applyMarimoTheme).toHaveBeenLastCalledWith(host, "dark", undefined);
    cleanup();
  });

  it("holds the document-navigation lease for a legacy runtime", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    dependencies.retainDocumentNavigation.mockReturnValue(releaseNavigation);
    dependencies.acquireAssets.mockReturnValue(assetsLease(false, releaseAssets));

    const cleanup = mountIsland(testHost(), payload());
    await flushMicrotasks();

    expect(releaseNavigation).not.toHaveBeenCalled();
    cleanup();
    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledTimes(1);
  });

  it("releases a runtime lease while activation is pending", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    const pending = deferred<boolean>();
    dependencies.retainDocumentNavigation.mockReturnValue(releaseNavigation);
    dependencies.acquireAssets.mockReturnValue(assetsLease(pending.promise, releaseAssets));

    const cleanup = mountIsland(testHost(), payload());
    cleanup();
    pending.resolve(true);
    await flushMicrotasks();

    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledTimes(1);
  });

  it("keeps native navigation active for confirmed runtime assets", () => {
    dependencies.hasConfirmedSoftNavigationAssets.mockReturnValue(true);
    dependencies.acquireAssets.mockReturnValue(assetsLease(true));

    const cleanup = mountIsland(testHost(), payload());

    expect(dependencies.retainDocumentNavigation).not.toHaveBeenCalled();
    cleanup();
  });

  it("acquires the navigation fallback when a confirmed lease resolves false", async () => {
    const releaseNavigation = vi.fn();
    dependencies.hasConfirmedSoftNavigationAssets.mockReturnValue(true);
    dependencies.retainDocumentNavigation.mockReturnValue(releaseNavigation);
    dependencies.acquireAssets.mockReturnValue(assetsLease(false));

    const cleanup = mountIsland(testHost(), payload());
    expect(dependencies.retainDocumentNavigation).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(dependencies.retainDocumentNavigation).toHaveBeenCalledOnce();
    expect(releaseNavigation).not.toHaveBeenCalled();

    cleanup();
    expect(releaseNavigation).toHaveBeenCalledOnce();
  });

  it("updates navigation fallback after a retained mount reconnects", async () => {
    const releaseNavigation = vi.fn();
    dependencies.hasConfirmedSoftNavigationAssets.mockReturnValue(true);
    dependencies.retainDocumentNavigation.mockReturnValue(releaseNavigation);
    const lease = assetsLease(false);
    lease.activate.mockResolvedValue(true);
    dependencies.acquireAssets.mockReturnValue(lease);
    const host = testHost();
    const cleanup = mountIsland(host, payload());
    await flushMicrotasks();
    expect(dependencies.retainDocumentNavigation).toHaveBeenCalledOnce();
    expect(releaseNavigation).not.toHaveBeenCalled();

    reconnectMarimoIsland(host);
    await flushMicrotasks();

    expect(lease.activate).toHaveBeenCalledTimes(2);
    expect(releaseNavigation).toHaveBeenCalledOnce();
    cleanup();
  });

  it("rejects hosts from another document", () => {
    const host = testHost({});

    expect(() => mountIsland(host, payload())).toThrowError(
      "Marimo islands must be mounted in the current document",
    );
  });
});

class TestHost {
  constructor(readonly ownerDocument = testDocument) {}

  readonly classList = { add: vi.fn() };
  readonly dataset: Record<string, string> = {};
  readonly replaceChildren = vi.fn();
  innerHTML = "";

  getAttribute(name: string): string | null {
    if (name === "data-marimo-theme-mode") return this.dataset.marimoThemeMode ?? null;
    return null;
  }
}

function testDependencies() {
  const dependencies = {
    acquireAssets: vi.fn<MarimoIslandMountDependencies["acquireAssets"]>(),
    applyMarimoTheme: vi.fn<MarimoIslandMountDependencies["applyMarimoTheme"]>(),
    hasConfirmedSoftNavigationAssets: vi.fn<
      MarimoIslandMountDependencies["hasConfirmedSoftNavigationAssets"]
    >(() => false),
    installMarimoThemeBridge: vi.fn<MarimoIslandMountDependencies["installMarimoThemeBridge"]>(() =>
      vi.fn(),
    ),
    refreshMarimoThemeBridge: vi.fn<MarimoIslandMountDependencies["refreshMarimoThemeBridge"]>(),
    retainDocumentNavigation: vi.fn<MarimoIslandMountDependencies["retainDocumentNavigation"]>(() =>
      vi.fn(),
    ),
  };
  return dependencies satisfies MarimoIslandMountDependencies;
}

function testHost(ownerDocument = testDocument): HTMLElement {
  vi.stubGlobal(
    "HTMLElement",
    class extends TestHost {
      constructor() {
        super(ownerDocument);
      }
    },
  );
  const host = new HTMLElement();
  vi.stubGlobal("HTMLElement", class {});
  return host;
}

function assetsLease(result: boolean | Promise<boolean>, release = vi.fn()) {
  const activate = vi.fn(() => Promise.resolve(result));
  return {
    activate,
    ready: activate(),
    release,
  };
}

function payload(): MarimoPageCellPayload {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: {
      id: "page-app",
      runtimeCellCount: 1,
      assets: { links: [], moduleScripts: ["https://example.test/main.js"] },
    },
    cell: {
      index: 0,
      html: '<marimo-island data-cell-index="0"></marimo-island>',
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
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
