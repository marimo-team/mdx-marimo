import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MarimoPageRuntime } from "../src/protocol";

type TestAppHost = {
  isConnected: boolean;
};

type TestMountConfig = {
  runtime: string;
  version?: string;
};

declare global {
  var __marimoAssetEvents: string[];
  var __marimoRuntimeThis: object | undefined;
}

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

describe("app asset lifecycle", () => {
  it.each([null, "invalid", 1, false])(
    "replaces the non-object mount config %j",
    async (mountConfig) => {
      vi.stubGlobal("window", {
        __MARIMO_MOUNT_CONFIG__: mountConfig,
        location: { reload: vi.fn() },
      });
      const { acquireAssets } = await import("../src/browser/assets");
      const lease = acquireAssets(app("configured-app", softModule()), appHost());

      expect(window.__MARIMO_MOUNT_CONFIG__).toEqual({ version: "0.23.16" });
      expect(await lease.ready).toBe(true);
      lease.release();
      await flushMicrotasks();
    },
  );

  it("adds the runtime version to the existing mount config", async () => {
    const mountConfig: TestMountConfig = { runtime: "pyodide" };
    vi.stubGlobal("window", {
      __MARIMO_MOUNT_CONFIG__: mountConfig,
      location: { reload: vi.fn() },
    });
    const { acquireAssets } = await import("../src/browser/assets");
    const lease = acquireAssets(app("configured-app", softModule()), appHost());

    expect(window.__MARIMO_MOUNT_CONFIG__).toBe(mountConfig);
    expect(mountConfig).toEqual({ runtime: "pyodide", version: "0.23.16" });
    expect(await lease.ready).toBe(true);
    lease.release();
    await flushMicrotasks();
  });

  it("activates with a non-writable primitive mount config", async () => {
    const runtimeWindow = { location: { reload: vi.fn() } };
    Object.defineProperty(runtimeWindow, "__MARIMO_MOUNT_CONFIG__", {
      value: "pyodide",
    });
    vi.stubGlobal("window", runtimeWindow);
    const { acquireAssets } = await import("../src/browser/assets");
    const lease = acquireAssets(app("configured-app", softModule()), appHost());

    expect(await lease.ready).toBe(true);
    expect(window.__MARIMO_MOUNT_CONFIG__).toBe("pyodide");
    lease.release();
    await flushMicrotasks();
  });

  it("activates with a non-extensible mount config", async () => {
    const mountConfig = Object.preventExtensions<TestMountConfig>({ runtime: "pyodide" });
    vi.stubGlobal("window", {
      __MARIMO_MOUNT_CONFIG__: mountConfig,
      location: { reload: vi.fn() },
    });
    const { acquireAssets } = await import("../src/browser/assets");
    const lease = acquireAssets(app("configured-app", softModule()), appHost());

    expect(await lease.ready).toBe(true);
    expect(window.__MARIMO_MOUNT_CONFIG__).toBe(mountConfig);
    expect(mountConfig).toEqual({ runtime: "pyodide" });
    lease.release();
    await flushMicrotasks();
  });

  it("activates with a non-writable mount config version", async () => {
    const mountConfig: TestMountConfig = { runtime: "pyodide" };
    Object.defineProperty(mountConfig, "version", { value: undefined });
    vi.stubGlobal("window", {
      __MARIMO_MOUNT_CONFIG__: mountConfig,
      location: { reload: vi.fn() },
    });
    const { acquireAssets } = await import("../src/browser/assets");
    const lease = acquireAssets(app("configured-app", softModule()), appHost());

    expect(await lease.ready).toBe(true);
    expect(window.__MARIMO_MOUNT_CONFIG__).toBe(mountConfig);
    expect(mountConfig.version).toBeUndefined();
    lease.release();
    await flushMicrotasks();
  });

  it("preserves the runtime module namespace and method receiver", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export default "runtime-default";
      export function canReplaceApp() {
        return this.default === "runtime-default";
      }
      export function initialize() {
        globalThis.__marimoRuntimeThis = this;
        globalThis.__marimoAssetEvents.push("initialize:" + this.default);
      }
      export function stopApp(appId) {
        globalThis.__marimoAssetEvents.push("stop:" + this.default + ":" + appId);
      }
    `);
    const namespace: object = await import(moduleScript);
    const lease = acquireAssets(app("namespace-app", moduleScript), appHost());

    expect(await lease.ready).toBe(true);
    expect(globalThis.__marimoRuntimeThis).toBe(namespace);
    expect(assetEvents()).toEqual(["initialize:runtime-default"]);

    lease.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual([
      "initialize:runtime-default",
      "stop:runtime-default:namespace-app",
    ]);
  });

  it("retains an app until its final host lease is released", async () => {
    vi.stubGlobal("__marimoCanReplaceApp", true);
    const { acquireAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const runtime = app(
      "retained-app",
      moduleUrl(`
        export function canReplaceApp() { return globalThis.__marimoCanReplaceApp; }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp(appId) {
          globalThis.__marimoAssetEvents.push("stop:" + appId);
        }
      `),
    );
    const host = appHost();

    const first = acquireAssets(runtime, host);
    const second = acquireAssets(runtime, host);
    expect(await first.ready).toBe(true);
    expect(await second.ready).toBe(true);
    expect(hasConfirmedSoftNavigationAssets(runtime)).toBe(true);
    expect(assetEvents()).toEqual(["initialize"]);

    first.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize"]);

    second.release();
    const retained = acquireAssets(runtime, host);
    expect(await retained.ready).toBe(true);
    expect(assetEvents()).toEqual(["initialize"]);

    retained.release();
    vi.stubGlobal("__marimoCanReplaceApp", false);
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize", "stop:retained-app"]);
  });

  it("skips an app released while the outgoing app is stopping", async () => {
    let finishStop!: () => void;
    vi.stubGlobal(
      "__marimoStopPromise",
      new Promise<void>((resolve) => {
        finishStop = resolve;
      }),
    );
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export function initialize() {
        globalThis.__marimoAssetEvents.push(
          "initialize:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp(appId) {
        globalThis.__marimoAssetEvents.push("stop:" + appId);
        return globalThis.__marimoStopPromise;
      }
    `);
    const first = acquireAssets(pageWithCode("first-app", "first", moduleScript), appHost());
    expect(await first.ready).toBe(true);

    const superseded = acquireAssets(
      pageWithCode("superseded-app", "superseded", moduleScript),
      appHost(),
    );
    await vi.waitFor(() => expect(assetEvents()).toEqual(["initialize:first", "stop:first-app"]));
    superseded.release();
    const current = acquireAssets(pageWithCode("current-app", "current", moduleScript), appHost());

    finishStop();
    expect(await superseded.ready).toBe(true);
    expect(await current.ready).toBe(true);
    expect(assetEvents()).toEqual(["initialize:first", "stop:first-app", "initialize:current"]);

    first.release();
    current.release();
    await flushMicrotasks();
  });

  it("stops an app released during initialization before activating the next app", async () => {
    let finishInitialization!: () => void;
    vi.stubGlobal(
      "__marimoInitializePromise",
      new Promise<void>((resolve) => {
        finishInitialization = resolve;
      }),
    );
    vi.stubGlobal("__marimoWaitForCode", "second");
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export async function initialize() {
        const code = globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode;
        globalThis.__marimoAssetEvents.push("start:" + code);
        if (code === globalThis.__marimoWaitForCode) {
          await globalThis.__marimoInitializePromise;
        }
        globalThis.__marimoAssetEvents.push("finish:" + code);
      }
      export function stopApp(appId) {
        globalThis.__marimoAssetEvents.push("stop:" + (appId ?? "current"));
      }
    `);
    const first = acquireAssets(pageWithCode("first-app", "first", moduleScript), appHost());
    await first.ready;
    const superseded = acquireAssets(pageWithCode("second-app", "second", moduleScript), appHost());
    await vi.waitFor(() => expect(assetEvents().at(-1)).toBe("start:second"));

    superseded.release();
    const current = acquireAssets(pageWithCode("third-app", "third", moduleScript), appHost());
    finishInitialization();
    await superseded.ready;
    await current.ready;

    expect(assetEvents()).toEqual([
      "start:first",
      "finish:first",
      "stop:first-app",
      "start:second",
      "finish:second",
      "stop:current",
      "start:third",
      "finish:third",
    ]);

    first.release();
    current.release();
    await flushMicrotasks();
  });

  it("serializes export context through asynchronous initialization", async () => {
    let finishInitialization!: () => void;
    vi.stubGlobal(
      "__marimoInitializePromise",
      new Promise<void>((resolve) => {
        finishInitialization = resolve;
      }),
    );
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      let initialization = 0;
      export function canReplaceApp() { return true; }
      export async function initialize() {
        const code = globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode;
        globalThis.__marimoAssetEvents.push("start:" + code);
        if (initialization++ === 0) await globalThis.__marimoInitializePromise;
        globalThis.__marimoAssetEvents.push(
          "finish:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp() {}
    `);
    const first = acquireAssets(pageWithCode("first-app", "first", moduleScript), appHost());
    await vi.waitFor(() => expect(assetEvents()).toEqual(["start:first"]));
    const second = acquireAssets(pageWithCode("second-app", "second", moduleScript), appHost());

    finishInitialization();
    await first.ready;
    await second.ready;
    expect(assetEvents()).toEqual(["start:first", "finish:first", "start:second", "finish:second"]);

    first.release();
    second.release();
    await flushMicrotasks();
  });

  it("reinitializes when a live app gains another cell host", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const runtime = app(
      "growing-app",
      moduleUrl(`
        export function canReplaceApp() { return true; }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp() {
          globalThis.__marimoAssetEvents.push("stop");
        }
      `),
    );
    const first = acquireAssets(runtime, appHost());
    await first.ready;
    const second = acquireAssets(runtime, appHost());
    await second.ready;

    expect(assetEvents()).toEqual(["initialize", "stop", "initialize"]);
    first.release();
    second.release();
    await flushMicrotasks();
  });

  it("reactivates a retained lease after its host reconnects", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export function initialize() {
        globalThis.__marimoAssetEvents.push(
          "initialize:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp(appId) {
        globalThis.__marimoAssetEvents.push("stop:" + appId);
      }
    `);
    const retainedHost = appHost();
    const retained = acquireAssets(
      pageWithCode("retained-app", "retained", moduleScript),
      retainedHost,
    );
    await retained.ready;

    retainedHost.isConnected = false;
    const current = acquireAssets(pageWithCode("current-app", "current", moduleScript), appHost());
    await current.ready;

    retainedHost.isConnected = true;
    await retained.activate();

    expect(assetEvents()).toEqual([
      "initialize:retained",
      "stop:retained-app",
      "initialize:current",
      "stop:current-app",
      "initialize:retained",
    ]);
    retained.release();
    current.release();
    await flushMicrotasks();
  });

  it("rechecks cell hosts mounted during initialization", async () => {
    let finishInitialization!: () => void;
    vi.stubGlobal(
      "__marimoInitializePromise",
      new Promise<void>((resolve) => {
        finishInitialization = resolve;
      }),
    );
    const { acquireAssets } = await import("../src/browser/assets");
    const runtime = app(
      "mounting-app",
      moduleUrl(`
        let initialization = 0;
        export function canReplaceApp() { return true; }
        export async function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
          if (initialization++ === 0) await globalThis.__marimoInitializePromise;
        }
        export function stopApp() {}
      `),
    );
    const first = acquireAssets(runtime, appHost());
    await vi.waitFor(() => expect(assetEvents()).toEqual(["initialize"]));
    const second = acquireAssets(runtime, appHost());

    finishInitialization();
    await first.ready;
    await second.ready;
    expect(assetEvents()).toEqual(["initialize", "initialize"]);

    first.release();
    second.release();
    await flushMicrotasks();
  });

  it("leaves first-page initialization to a legacy runtime", async () => {
    const { acquireAssets, hasConfirmedSoftNavigationAssets } =
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
    const lease = acquireAssets(runtime, appHost());

    expect(await lease.ready).toBe(false);
    expect(hasConfirmedSoftNavigationAssets(runtime)).toBe(false);
    expect(assetEvents()).toEqual(["module-loaded"]);
    lease.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["module-loaded"]);
  });

  it("requires the safe runtime version for retained handoff", async () => {
    const { acquireAssets, hasConfirmedSoftNavigationAssets } =
      await import("../src/browser/assets");
    const runtime = app(
      "unsafe-app",
      moduleUrl(`
        export function canReplaceApp() { return true; }
        export function initialize() {}
        export function stopApp() {}
      `),
      "0.23.15",
    );
    const lease = acquireAssets(runtime, appHost());

    expect(await lease.ready).toBe(false);
    expect(hasConfirmedSoftNavigationAssets(runtime)).toBe(false);
    lease.release();
  });

  it("reloads before replacing an app owned by an unsafe runtime", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export function initialize() {}
      export function stopApp() {}
    `);
    const first = acquireAssets(app("first-app", moduleScript, "0.23.15"), appHost());
    await first.ready;
    const replacement = acquireAssets(app("second-app", moduleScript, "0.23.15"), appHost());

    await vi.waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce());
    await expectPending(replacement.ready);
  });

  it("sets first-page context before a legacy module evaluates", async () => {
    let finishModule!: () => void;
    vi.stubGlobal(
      "__marimoModulePromise",
      new Promise<void>((resolve) => {
        finishModule = resolve;
      }),
    );
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      globalThis.__marimoAssetEvents.push("module-start");
      await globalThis.__marimoModulePromise;
      globalThis.__marimoAssetEvents.push(
        "module:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
      );
      export function initialize() {}
    `);
    const first = acquireAssets(pageWithCode("first-app", "first", moduleScript), appHost());
    await vi.waitFor(() => expect(assetEvents()).toEqual(["module-start"]));
    const replacement = acquireAssets(
      pageWithCode("second-app", "second", moduleScript),
      appHost(),
    );

    finishModule();
    expect(await first.ready).toBe(false);
    await vi.waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce());
    expect(assetEvents()).toEqual(["module-start", "module:first"]);
    await expectPending(replacement.ready);
  });

  it("reactivates a changed revision under the same app ID", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export function initialize() {
        globalThis.__marimoAssetEvents.push(
          "initialize:" + globalThis.window.__MARIMO_EXPORT_CONTEXT__.notebookCode,
        );
      }
      export function stopApp() {}
    `);
    const host = appHost();
    const runtime = pageWithCode("stable-app", "x = 1", moduleScript);
    const first = acquireAssets(runtime, host);
    await first.ready;
    runtime.notebookCode = "x = 2";
    const next = acquireAssets(runtime, host);
    await next.ready;

    expect(assetEvents()).toEqual(["initialize:x = 1", "initialize:x = 2"]);
    first.release();
    next.release();
    await flushMicrotasks();
  });

  it("can retry after a replacement initializer rejects", async () => {
    vi.stubGlobal("__marimoFailReplacement", true);
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
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
    const host = appHost();
    const firstApp = pageWithCode("stable-app", "x = 1", moduleScript);
    const first = acquireAssets(firstApp, host);
    await first.ready;
    const failed = acquireAssets(pageWithCode("stable-app", "x = 2", moduleScript), host);
    await expect(failed.ready).rejects.toThrow("replacement failed");
    const retry = acquireAssets(firstApp, host);
    await retry.ready;

    expect(assetEvents()).toEqual(["initialize:x = 1", "initialize:x = 2", "initialize:x = 1"]);
    first.release();
    retry.release();
    await flushMicrotasks();
  });

  it("reloads and blocks replacement when teardown fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { acquireAssets } = await import("../src/browser/assets");
    const moduleScript = moduleUrl(`
      export function canReplaceApp() { return true; }
      export function initialize() {
        globalThis.__marimoAssetEvents.push("initialize");
      }
      export function stopApp() {
        throw new Error("teardown failed");
      }
    `);
    const first = acquireAssets(app("first-app", moduleScript), appHost());
    await first.ready;
    const replacement = acquireAssets(app("second-app", moduleScript), appHost());

    await vi.waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce());
    expect(assetEvents()).toEqual(["initialize"]);
    await expectPending(replacement.ready);
  });

  it("coalesces reloads before a different runtime evaluates", async () => {
    const { acquireAssets } = await import("../src/browser/assets");
    const first = acquireAssets(app("first-app", softModule(), "0.23.16"), appHost());
    await first.ready;
    const nextModule = moduleUrl(`
      globalThis.__marimoAssetEvents.push("next-module-loaded");
      export function initialize() {}
    `);
    const firstReplacement = acquireAssets(app("next-app", nextModule, "0.23.17"), appHost());
    const secondReplacement = acquireAssets(app("next-app", nextModule, "0.23.17"), appHost());

    expect(window.location.reload).toHaveBeenCalledOnce();
    expect(assetEvents()).toEqual([]);
    await expectPending(firstReplacement.ready);
    await expectPending(secondReplacement.ready);
  });

  it("shares leases across bridge module instances", async () => {
    const firstBridge = await import("../src/browser/assets");
    const runtime = app(
      "shared-app",
      moduleUrl(`
        export function canReplaceApp() { return true; }
        export function initialize() {
          globalThis.__marimoAssetEvents.push("initialize");
        }
        export function stopApp(appId) {
          globalThis.__marimoAssetEvents.push("stop:" + appId);
        }
      `),
    );
    const host = appHost();
    const first = firstBridge.acquireAssets(runtime, host);
    await first.ready;

    vi.resetModules();
    const secondBridge = await import("../src/browser/assets");
    const second = secondBridge.acquireAssets(runtime, host);
    await second.ready;

    expect(assetEvents()).toEqual(["initialize"]);
    first.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize"]);
    second.release();
    await flushMicrotasks();
    expect(assetEvents()).toEqual(["initialize", "stop:shared-app"]);
  });
});

function app(id: string, moduleScript: string, version = "0.23.16"): MarimoPageRuntime {
  return {
    id,
    runtimeCellCount: 1,
    assets: { links: [], moduleScripts: [moduleScript], version },
  };
}

function pageWithCode(id: string, notebookCode: string, moduleScript: string): MarimoPageRuntime {
  return { ...app(id, moduleScript), notebookCode };
}

function softModule(): string {
  return moduleUrl(`
    export function canReplaceApp() { return true; }
    export function initialize() {}
    export function stopApp() {}
  `);
}

function moduleUrl(source: string): string {
  moduleId += 1;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${moduleId}`;
}

function appHost(): TestAppHost {
  return { isConnected: true };
}

function assetEvents(): string[] {
  return globalThis.__marimoAssetEvents;
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
