import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { installMarimoIslandStyles } from "../src/browser/styles";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("installMarimoIslandStyles", () => {
  it("installs one resolved stylesheet link per document", () => {
    const links: TestLink[] = [];
    const target = stylesheetDocument(links);

    const first = installMarimoIslandStyles("./islands.css", target);
    const second = installMarimoIslandStyles("https://example.test/book/islands.css", target);

    expect(first).toBe(second);
    expect(first.href).toBe("https://example.test/book/islands.css");
    expect(links).toHaveLength(1);
  });

  it("requires a stylesheet URL", () => {
    expect(() => installMarimoIslandStyles(" ", stylesheetDocument([]))).toThrowError(
      "Marimo island stylesheet URL must not be empty",
    );
  });
});

function stylesheetDocument(links: TestLink[]): Document {
  vi.stubGlobal(
    "Document",
    class {
      readonly baseURI = "https://example.test/book/";
      readonly head = {
        append: (link: TestLink) => links.push(link),
        querySelectorAll: () => links,
      };

      readonly createElement = vi.fn(() => new TestLink());
    },
  );
  return new Document();
}

class TestLink {
  readonly dataset: Record<string, string> = {};
  href = "";
  rel = "";
}
