import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MarimoPageRuntime } from "../src/protocol";

let moduleId = 0;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { location: { reload: vi.fn() } });
  vi.stubGlobal("document", { baseURI: "http://example.test/docs/" });
  vi.stubGlobal("__marimoAssetEvents", []);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("ensureAssets", () => {
  it("retains a soft-navigation app until its final lease is released", async () => {
    const { ensureAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const runtime = app(
      "soft-navigation-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp(appId) {
          globalThis.__marimoAssetEvents.push("stop:" + appId);
        }
      `),
    );

    const first = await ensureAssets(runtime);
    const second = await ensureAssets(runtime);

    expect(first.supportsSoftNavigation).toBe(true);
    expect(second.supportsSoftNavigation).toBe(true);
    expect(hasConfirmedSoftNavigationAssets(runtime)).toBe(true);
    expect(assetEvents()).toEqual(["initialize"]);

    first.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize"]);

    second.release();
    const retained = await ensureAssets(runtime);
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize"]);

    retained.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize", "stop:soft-navigation-app"]);

    const replacement = await ensureAssets(runtime);
    expect(assetEvents()).toEqual(["initialize", "stop:soft-navigation-app", "initialize"]);
    replacement.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual([
      "initialize",
      "stop:soft-navigation-app",
      "initialize",
      "stop:soft-navigation-app",
    ]);
  });

  it("reactivates the last app requested during rapid navigation", async () => {
    const { ensureAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() {
        return true;
      }
      export function initialize() {
        globalThis.__marimoAssetEvents.push(
          "initialize:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp() {}
    `);
    const firstApp = {
      ...app("first-app", moduleScript),
      notebookCode: "first",
    };
    const secondApp = {
      ...app("second-app", moduleScript),
      notebookCode: "second",
    };

    const first = await ensureAssets(firstApp);
    const secondPending = ensureAssets(secondApp);
    const firstAgainPending = ensureAssets(firstApp);
    const [second, firstAgain] = await Promise.all([secondPending, firstAgainPending]);

    expect(assetEvents()).toEqual(["initialize:first", "initialize:second", "initialize:first"]);

    first.release();
    second.release();
    firstAgain.release();
    await flushMicrotasks();
  });

  it("keeps first-page initialization owned by a legacy runtime module", async () => {
    const { ensureAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const runtime = app(
      "legacy-app",
      moduleUrl(`
        globalThis.__marimoAssetEvents.push("module-loaded");
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
      `),
    );

    const lease = await ensureAssets(runtime);

    expect(lease.supportsSoftNavigation).toBe(false);
    expect(hasConfirmedSoftNavigationAssets(runtime)).toBe(false);
    expect(assetEvents()).toEqual(["module-loaded"]);
    lease.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["module-loaded"]);
  });

  it("rechecks a loaded runtime's capability for the current page", async () => {
    vi.stubGlobal("__marimoSupportsSoftNavigation", true);
    const { ensureAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
        export function canReplaceApp() {
        return globalThis.__marimoSupportsSoftNavigation;
      }
      export function initialize() {}
      export function stopApp() {}
    `);
    const firstApp = app("first-app", moduleScript);
    const secondApp = app("second-app", moduleScript);

    const first = await ensureAssets(firstApp);
    expect(first.supportsSoftNavigation).toBe(true);
    expect(hasConfirmedSoftNavigationAssets(secondApp)).toBe(true);
    first.release();
    await flushMicrotasks();

    vi.stubGlobal("__marimoSupportsSoftNavigation", false);
    expect(hasConfirmedSoftNavigationAssets(secondApp)).toBe(false);
    const second = await ensureAssets(secondApp);
    expect(second.supportsSoftNavigation).toBe(false);
    second.release();
  });

  it("waits for app teardown before reactivation", async () => {
    let finishDetach!: () => void;
    vi.stubGlobal(
      "__marimoDetachPromise",
      new Promise<void>((resolve) => {
        finishDetach = resolve;
      }),
    );
    const { ensureAssets } = await import("../src/browser/assets");
    const runtime = app(
      "ordered-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp() {
          globalThis.__marimoAssetEvents.push("stop");
          return globalThis.__marimoDetachPromise;
        }
      `),
    );

    const first = await ensureAssets(runtime);
    first.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize", "stop"]);

    let reactivated = false;
    const pending = ensureAssets(runtime).then((lease) => {
      reactivated = true;
      return lease;
    });
    await flushMicrotasks();
    expect(reactivated).toBe(false);

    finishDetach();
    const replacement = await pending;
    expect(assetEvents()).toEqual(["initialize", "stop", "initialize"]);
    replacement.release();
    await flushMicrotasks();
  });

  it("reactivates a changed app revision under the same ID", async () => {
    const { ensureAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
        export function canReplaceApp() {
        return true;
      }
      export function initialize() {
        globalThis.__marimoAssetEvents.push(
          "initialize:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp() {}
    `);
    const firstApp = {
      ...app("stable-app", moduleScript),
      notebookCode: "x = 1",
    };
    const nextApp = {
      ...app("stable-app", moduleScript),
      notebookCode: "x = 2",
    };

    const firstPending = ensureAssets(firstApp);
    const nextPending = ensureAssets(nextApp);
    const [first, next] = await Promise.all([firstPending, nextPending]);

    expect(assetEvents()).toEqual(["initialize:x = 1", "initialize:x = 2"]);

    first.release();
    next.release();
    await flushMicrotasks();
  });

  it("reactivates the prior revision after replacement fails", async () => {
    vi.stubGlobal("__marimoFailReplacement", true);
    const { ensureAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
        export function canReplaceApp() {
        return true;
      }
      export function initialize() {
        const code = globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode;
        globalThis.__marimoAssetEvents.push("initialize:" + code);
        if (code === "x = 2" && globalThis.__marimoFailReplacement) {
          globalThis.__marimoFailReplacement = false;
          throw new Error("replacement failed");
        }
      }
      export function stopApp() {}
    `);
    const firstApp = {
      ...app("stable-app", moduleScript),
      notebookCode: "x = 1",
    };
    const nextApp = {
      ...app("stable-app", moduleScript),
      notebookCode: "x = 2",
    };

    const first = await ensureAssets(firstApp);
    await expect(ensureAssets(nextApp)).rejects.toThrow("replacement failed");
    const retry = await ensureAssets(firstApp);

    expect(assetEvents()).toEqual(["initialize:x = 1", "initialize:x = 2", "initialize:x = 1"]);

    first.release();
    retry.release();
    await flushMicrotasks();
  });

  it("allows reactivation after teardown reports an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ensureAssets } = await import("../src/browser/assets");
    const runtime = app(
      "teardown-error-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp() {
          throw new Error("teardown failed");
        }
      `),
    );

    const first = await ensureAssets(runtime);
    first.release();
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());

    const replacement = await ensureAssets(runtime);
    expect(assetEvents()).toEqual(["initialize", "initialize"]);
    replacement.release();
    await flushMicrotasks();
  });

  it("reloads before activating a different runtime version", async () => {
    const { ensureAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
        export function canReplaceApp() {
        return true;
      }
      export function initialize() {
        globalThis.__marimoAssetEvents.push("initialize");
      }
      export function stopApp() {}
    `);
    const firstApp = app("first-app", moduleScript, "0.23.1");
    const nextApp = app("next-app", moduleScript, "0.23.8");

    await ensureAssets(firstApp);
    const pending = ensureAssets(nextApp);
    await flushMicrotasks();

    expect(hasConfirmedSoftNavigationAssets(nextApp)).toBe(false);
    expect(window.location.reload).toHaveBeenCalledOnce();
    expect(assetEvents()).toEqual(["initialize"]);
    await expectPending(pending);
  });

  it("coalesces reloads before a different runtime module evaluates", async () => {
    const { ensureAssets } = await import("../src/browser/assets");
    const firstApp = app(
      "first-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {}
        export function stopApp() {}
      `),
      "0.23.1",
    );
    const nextApp = app(
      "next-app",
      moduleUrl(`
        globalThis.__marimoAssetEvents.push("next-module-loaded");
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {}
        export function stopApp() {}
      `),
      "0.23.1",
    );

    const first = await ensureAssets(firstApp);
    first.release();
    await flushMicrotasks();

    const firstPending = ensureAssets(nextApp);
    const secondPending = ensureAssets(nextApp);
    await flushMicrotasks();

    expect(window.location.reload).toHaveBeenCalledOnce();
    expect(assetEvents()).toEqual([]);
    await expectPending(firstPending);
    await expectPending(secondPending);
  });

  it("shares runtime identity across bridge module instances", async () => {
    const firstBridge = await import("../src/browser/assets");
    const firstApp = app(
      "first-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {}
        export function stopApp() {}
      `),
      "0.23.1",
    );
    await firstBridge.ensureAssets(firstApp);

    vi.resetModules();
    const secondBridge = await import("../src/browser/assets");
    const pending = secondBridge.ensureAssets(
      app("next-app", moduleUrl("export function initialize() {}"), "0.23.1"),
    );
    await flushMicrotasks();

    expect(window.location.reload).toHaveBeenCalledOnce();
    await expectPending(pending);
  });

  it("shares app leases across bridge module instances", async () => {
    const firstBridge = await import("../src/browser/assets");
    const runtime = app(
      "shared-app",
      moduleUrl(`
        export function canReplaceApp() {
          return true;
        }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp(appId) {
          globalThis.__marimoAssetEvents.push("stop:" + appId);
        }
      `),
    );
    const first = await firstBridge.ensureAssets(runtime);

    vi.resetModules();
    const secondBridge = await import("../src/browser/assets");
    const second = await secondBridge.ensureAssets(runtime);

    expect(assetEvents()).toEqual(["initialize"]);
    first.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize"]);

    second.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize", "stop:shared-app"]);
  });
});

function app(id: string, moduleScript: string, version?: string): MarimoPageRuntime {
  return {
    id,
    runtimeCellCount: 1,
    assets: {
      links: [],
      moduleScripts: [moduleScript],
      ...(version ? { version } : {}),
    },
  };
}

function moduleUrl(source: string): string {
  moduleId += 1;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${moduleId}`;
}

function assetEvents(): string[] {
  return (globalThis as typeof globalThis & { __marimoAssetEvents: string[] }).__marimoAssetEvents;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function expectPending(promise: Promise<unknown>): Promise<void> {
  let settled = false;
  void promise.finally(() => {
    settled = true;
  });
  await flushMicrotasks();
  expect(settled).toBe(false);
}
