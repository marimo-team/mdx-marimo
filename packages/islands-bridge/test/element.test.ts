import { afterEach, describe, expect, it } from "vite-plus/test";
import { defineMarimoIslandElement } from "../src/element";

const originalCustomElements = Object.getOwnPropertyDescriptor(globalThis, "customElements");
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");

afterEach(() => {
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
    const element = new constructor!();

    expect(element).toBeInstanceOf(TestHTMLElement);
    expect(element).toBeInstanceOf(constructor!);
    expect(
      (constructor as CustomElementConstructor & { observedAttributes: string[] })
        .observedAttributes,
    ).toEqual(["data-marimo-theme-mode"]);
  });
});

function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}
