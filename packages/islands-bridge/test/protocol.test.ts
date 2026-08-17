import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  encodePageCellPayload,
  pageCellReferencePayload,
  pageCellPayload,
  parseCompiledMarimoPage,
  parseMarimoPageSerializedCellPayload,
  projectPageCellPayloads,
  type CompiledMarimoPage,
  type JsonValue,
} from "../src/protocol";

describe("marimo page protocol", () => {
  it("projects included cells with one app carrier", () => {
    const page = compiledPage();
    page.cells.splice(1, 0, {
      ...page.cells[0]!,
      index: 1,
      options: {
        ...page.cells[0]!.options,
        render: { ...page.cells[0]!.options.render, include: false },
      },
    });
    page.cells.push({ ...page.cells[0]!, index: 2 });

    const payloads = projectPageCellPayloads(page);

    expect(payloads).toHaveLength(3);
    expect(payloads[0]).toMatchObject({ app: { id: "marimo-test" }, cell: { index: 0 } });
    expect(payloads[1]).toBeNull();
    expect(payloads[2]).toMatchObject({ appId: "marimo-test", cell: { index: 2 } });
    expect(payloads[0]?.cell).not.toHaveProperty("output");
    expect(payloads[2]?.cell).not.toHaveProperty("output");
  });

  it("projects static cells as self-contained payloads", () => {
    const page = { ...compiledPage(), app: null };
    page.cells.push({ ...page.cells[0]!, index: 1 });

    const payloads = projectPageCellPayloads(page);

    expect(payloads).toMatchObject([
      { app: null, cell: { index: 0 } },
      { app: null, cell: { index: 1 } },
    ]);
  });

  it("rejects compiled cells that do not match authored positions", () => {
    const page = compiledPage();
    page.cells[0] = { ...page.cells[0]!, index: 1 };

    expect(() => projectPageCellPayloads(page)).toThrow("returned cell indices [1]; expected [0]");
  });

  it("encodes payloads as base64url JSON", () => {
    const page = compiledPage();
    const payload = pageCellPayload(page, {
      ...page.cells[0]!,
      html: "<p>Grüße 👋</p>",
    });

    const encoded = encodePageCellPayload(payload);
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(padded), (value) => value.charCodeAt(0))),
    );

    expect(decoded).toEqual(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("parses compiler and browser records at the v2 boundary", () => {
    const page = compiledPage();
    const payload = pageCellPayload(page, page.cells[0]!);
    const reference = pageCellReferencePayload(page, page.cells[0]!);

    expect(MARIMO_PAGE_PROTOCOL_VERSION).toBe(2);
    expect(parseCompiledMarimoPage(jsonValue(page))).toEqual(page);
    expect(parseMarimoPageSerializedCellPayload(jsonValue(payload))).toEqual(payload);
    expect(parseMarimoPageSerializedCellPayload(jsonValue(reference))).toEqual(reference);
    expect(parseCompiledMarimoPage(jsonValue({ ...page, cells: [payload.cell] }))).toBeUndefined();
    expect(
      parseMarimoPageSerializedCellPayload(jsonValue({ ...payload, protocolVersion: 1 })),
    ).toBeUndefined();
    expect(
      parseMarimoPageSerializedCellPayload(jsonValue({ ...reference, appId: "" })),
    ).toBeUndefined();
  });

  it("requires exactly one own payload discriminator", () => {
    const page = compiledPage();
    const payload = pageCellPayload(page, page.cells[0]!);

    expect(
      parseMarimoPageSerializedCellPayload(jsonValue({ ...payload, appId: "marimo-test" })),
    ).toBeUndefined();
    expect(
      parseMarimoPageSerializedCellPayload(
        jsonValue({ protocolVersion: payload.protocolVersion, cell: payload.cell }),
      ),
    ).toBeUndefined();
  });

  it("rejects boxed strings and non-plain protocol records", () => {
    const page = compiledPage();
    const reference = pageCellReferencePayload(page, page.cells[0]!);
    const boxedAppId = defineRuntimeProperty(jsonValue(reference), "appId", Object("marimo-test"));

    expect(parseMarimoPageSerializedCellPayload(boxedAppId)).toBeUndefined();
    for (const value of [
      runtimeJsonValue(() => 1),
      runtimeJsonValue(new Date("2026-08-16T00:00:00Z")),
      runtimeJsonValue(new Map([["appId", "marimo-test"]])),
    ]) {
      expect(parseMarimoPageSerializedCellPayload(value)).toBeUndefined();
      expect(parseCompiledMarimoPage(value)).toBeUndefined();
    }
  });

  it("parses protocol records from another JavaScript realm", () => {
    const page = compiledPage();
    const foreignPage: JsonValue = runInNewContext("JSON.parse(source)", {
      source: JSON.stringify(page),
    });

    expect(parseCompiledMarimoPage(foreignPage)).toEqual(page);
  });

  it("retains validated compiler output data", () => {
    const page = compiledPage();
    if (!page.cells[0]?.output) throw new Error("Expected compiled page output");
    const data: JsonValue = JSON.parse('{"series":[1,2,3]}');
    page.cells[0].output.data = data;

    const parsed = parseCompiledMarimoPage(runtimeJsonValue(page));

    expect(parsed?.cells[0]?.output?.data).toBe(data);
  });

  it("rejects sparse compiler output data", () => {
    const page = compiledPage();
    if (!page.cells[0]?.output) throw new Error("Expected compiled page output");
    const data: JsonValue[] = [];
    data.length = 1;
    page.cells[0].output.data = data;

    expect(parseCompiledMarimoPage(runtimeJsonValue(page))).toBeUndefined();
  });

  it("rejects protocol records with an arbitrary null-root prototype", () => {
    const prototype = Object.create(null);
    Object.defineProperty(prototype, "inherited", {
      enumerable: true,
      value: "not an own JSON field",
    });
    const page = Object.assign(Object.create(prototype), jsonValue(compiledPage()));

    expect(parseCompiledMarimoPage(runtimeJsonValue(page))).toBeUndefined();
  });

  it("preserves __proto__ as own data in parsed dictionaries", () => {
    const page = compiledPage();
    if (!page.app || !page.cells[0]?.output) throw new Error("Expected compiled page fixtures");
    page.cells[0].output.data = JSON.parse('{"__proto__":{"polluted":true}}');
    page.app.assets.links = [JSON.parse('{"__proto__":"/styles.css"}')];
    page.app.assets.headTags = [{ tag: "meta", attrs: JSON.parse('{"__proto__":"safe"}') }];

    const parsed = parseCompiledMarimoPage(jsonValue(page));
    const outputData = parsed?.cells[0]?.output?.data;
    const link = parsed?.app?.assets.links[0];
    const attrs = parsed?.app?.assets.headTags?.[0]?.attrs;
    if (outputData === undefined || link === undefined || attrs === undefined) {
      throw new Error("Expected parsed protocol dictionaries");
    }

    expect(Object.getOwnPropertyDescriptor(outputData, "__proto__")?.value).toEqual({
      polluted: true,
    });
    expect(Object.getOwnPropertyDescriptor(link, "__proto__")?.value).toBe("/styles.css");
    expect(Object.getOwnPropertyDescriptor(attrs, "__proto__")?.value).toBe("safe");
    expect(Object.getPrototypeOf(outputData)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(link)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });
});

function jsonValue<T>(value: T): JsonValue {
  return JSON.parse(JSON.stringify(value));
}

function defineRuntimeProperty<T, V>(owner: T, key: string, value: V): T {
  Object.defineProperty(owner, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  return owner;
}

function runtimeJsonValue<T>(value: T): JsonValue {
  const container: JsonValue[] = [null];
  Object.defineProperty(container, 0, { value });
  return container[0]!;
}

function compiledPage(): CompiledMarimoPage {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: {
      id: "marimo-test",
      runtimeCellCount: 1,
      assets: {
        links: [{ href: "/style.css", rel: "stylesheet" }],
        moduleScripts: ["/runtime.js"],
      },
      notebookCode: "x = 1",
    },
    cells: [
      {
        index: 0,
        html: "<marimo-island></marimo-island>",
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
        output: {
          mimetype: "text/plain",
          data: "1",
          html: "<span>1</span>",
        },
      },
    ],
    diagnostics: [],
  };
}
