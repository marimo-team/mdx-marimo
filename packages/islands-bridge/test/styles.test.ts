import { describe, expect, it, vi } from "vite-plus/test";
import { installMarimoIslandStyles } from "../src/browser/styles";

describe("installMarimoIslandStyles", () => {
  it("installs one resolved stylesheet link per document", () => {
    const links: TestLink[] = [];
    const target = {
      baseURI: "https://example.test/book/",
      createElement: vi.fn(() => new TestLink()),
      head: {
        append: (link: TestLink) => links.push(link),
        querySelectorAll: () => links,
      },
    } as unknown as Document;

    const first = installMarimoIslandStyles("./islands.css", target);
    const second = installMarimoIslandStyles("https://example.test/book/islands.css", target);

    expect(first).toBe(second);
    expect(first.href).toBe("https://example.test/book/islands.css");
    expect(links).toHaveLength(1);
  });

  it("requires a stylesheet URL", () => {
    expect(() => installMarimoIslandStyles(" ", {} as Document)).toThrowError(
      "Marimo island stylesheet URL must not be empty",
    );
  });
});

class TestLink {
  readonly dataset: Record<string, string> = {};
  href = "";
  rel = "";
}
