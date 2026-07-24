import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  ensureAssets,
  hasConfirmedSoftNavigationAssets,
  type MarimoAssetsLease,
} from "../src/browser/assets";
import { mountMarimoIsland } from "../src/browser/island";
import { retainDocumentNavigation } from "../src/browser/navigation";
import { applyMarimoTheme, installMarimoThemeBridge } from "../src/browser/theme";
import { MARIMO_PAGE_PROTOCOL_VERSION, type MarimoPageCellPayload } from "../src/protocol";

vi.mock("../src/browser/assets", () => ({
  ensureAssets: vi.fn(),
  hasConfirmedSoftNavigationAssets: vi.fn(() => false),
}));
vi.mock("../src/browser/navigation", () => ({
  retainDocumentNavigation: vi.fn(),
}));
vi.mock("../src/browser/theme", () => ({
  applyMarimoTheme: vi.fn(),
  installMarimoThemeBridge: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(hasConfirmedSoftNavigationAssets).mockReturnValue(false);
  vi.mocked(installMarimoThemeBridge).mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mountMarimoIsland", () => {
  it("releases the document-navigation lease for a soft-navigation runtime", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    vi.mocked(retainDocumentNavigation).mockReturnValue(releaseNavigation);
    vi.mocked(ensureAssets).mockResolvedValue({
      release: releaseAssets,
      supportsSoftNavigation: true,
    });

    const host = new TestHost();
    const cleanup = mountMarimoIsland(host as unknown as HTMLElement, payload());
    await flushMicrotasks();

    expect(releaseNavigation).toHaveBeenCalledTimes(1);
    expect(applyMarimoTheme).toHaveBeenCalledWith(host, "auto");

    cleanup();
    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledOnce();
  });

  it("holds the document-navigation lease for a legacy runtime", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    vi.mocked(retainDocumentNavigation).mockReturnValue(releaseNavigation);
    vi.mocked(ensureAssets).mockResolvedValue({
      release: releaseAssets,
      supportsSoftNavigation: false,
    });

    const cleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());
    await flushMicrotasks();

    expect(releaseNavigation).not.toHaveBeenCalled();
    cleanup();
    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledTimes(1);
  });

  it("releases a runtime lease that resolves after unmount", async () => {
    const releaseNavigation = vi.fn();
    const releaseAssets = vi.fn();
    const pending = deferred<MarimoAssetsLease>();
    vi.mocked(retainDocumentNavigation).mockReturnValue(releaseNavigation);
    vi.mocked(ensureAssets).mockReturnValue(pending.promise);

    const cleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());
    cleanup();
    pending.resolve({
      release: releaseAssets,
      supportsSoftNavigation: true,
    });
    await flushMicrotasks();

    expect(releaseAssets).toHaveBeenCalledTimes(1);
    expect(releaseNavigation).toHaveBeenCalledTimes(1);
  });

  it("keeps native navigation active for confirmed runtime assets", () => {
    vi.mocked(hasConfirmedSoftNavigationAssets).mockReturnValue(true);
    vi.mocked(ensureAssets).mockResolvedValue({
      release: vi.fn(),
      supportsSoftNavigation: true,
    });

    const cleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());

    expect(retainDocumentNavigation).not.toHaveBeenCalled();
    cleanup();
  });

  it("acquires the navigation fallback when a confirmed lease resolves false", async () => {
    const releaseNavigation = vi.fn();
    vi.mocked(hasConfirmedSoftNavigationAssets).mockReturnValue(true);
    vi.mocked(retainDocumentNavigation).mockReturnValue(releaseNavigation);
    vi.mocked(ensureAssets).mockResolvedValue({
      release: vi.fn(),
      supportsSoftNavigation: false,
    });

    const cleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());
    expect(retainDocumentNavigation).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(retainDocumentNavigation).toHaveBeenCalledOnce();
    expect(releaseNavigation).not.toHaveBeenCalled();

    cleanup();
    expect(releaseNavigation).toHaveBeenCalledOnce();
  });

  it("reacquires the navigation fallback when the current page is not confirmed", async () => {
    const releaseNavigation = vi.fn();
    vi.mocked(retainDocumentNavigation).mockReturnValue(releaseNavigation);
    vi.mocked(hasConfirmedSoftNavigationAssets)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    vi.mocked(ensureAssets)
      .mockResolvedValueOnce({ release: vi.fn(), supportsSoftNavigation: true })
      .mockResolvedValueOnce({ release: vi.fn(), supportsSoftNavigation: false });

    const firstCleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());
    await flushMicrotasks();
    firstCleanup();

    const secondCleanup = mountMarimoIsland(new TestHost() as unknown as HTMLElement, payload());
    await flushMicrotasks();

    expect(retainDocumentNavigation).toHaveBeenCalledOnce();
    expect(releaseNavigation).not.toHaveBeenCalled();
    secondCleanup();
    expect(releaseNavigation).toHaveBeenCalledOnce();
  });
});

class TestHost {
  readonly classList = { add: vi.fn() };
  readonly dataset: Record<string, string> = {};
  readonly replaceChildren = vi.fn();
  innerHTML = "";
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

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
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
