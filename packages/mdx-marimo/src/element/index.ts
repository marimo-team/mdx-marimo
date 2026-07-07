import { mountMarimoIsland, renderMarimoIslandError } from "../browser/island";
import type { MarimoOutput } from "../schema";
import { defaultMarimoElementName } from "./name";

export { defaultMarimoElementName };

const MarimoElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class MarimoMdxIslandElement extends MarimoElementBase {
  static get observedAttributes(): string[] {
    return ["data-marimo-theme-mode"];
  }

  #cleanup: (() => void) | undefined;
  #mountQueued = false;
  #output: MarimoOutput | undefined;
  #payloadObserver: MutationObserver | undefined;
  #payloadTimeout: number | undefined;

  connectedCallback(): void {
    this.#queueMount();
  }

  disconnectedCallback(): void {
    this.#cleanup?.();
    this.#cleanup = undefined;
    this.#stopPayloadWait();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (this.isConnected && this.#output) this.#queueMount();
  }

  #queueMount(): void {
    if (this.#mountQueued) return;
    this.#mountQueued = true;
    queueMicrotask(() => {
      this.#mountQueued = false;
      if (this.isConnected) this.#mount();
    });
  }

  #mount(): void {
    try {
      this.#output = this.#output ?? readOutput(this);
      if (!this.#output) {
        this.#waitForPayload();
        return;
      }
      this.#stopPayloadWait();
      this.#cleanup?.();
      this.#cleanup = mountMarimoIsland(this, this.#output, {
        theme: themeFromElement(this),
      });
    } catch (error: unknown) {
      this.#cleanup?.();
      this.#cleanup = undefined;
      this.#stopPayloadWait();
      this.classList.add("marimo-island-host");
      this.dataset.marimoHost = "mdx";
      this.innerHTML = "";
      renderMarimoIslandError(this, error);
    }
  }

  #waitForPayload(): void {
    if (this.#payloadObserver || typeof MutationObserver === "undefined") return;
    this.#payloadObserver = new MutationObserver(() => {
      if (readOutputSource(this)) this.#queueMount();
    });
    this.#payloadObserver.observe(this, { childList: true, subtree: true });
    this.#payloadTimeout = window.setTimeout(() => {
      this.#stopPayloadWait();
      if (this.isConnected && !this.#output) {
        this.classList.add("marimo-island-host");
        this.dataset.marimoHost = "mdx";
        renderMarimoIslandError(this, new Error("Missing marimo output payload"));
      }
    }, 1000);
  }

  #stopPayloadWait(): void {
    this.#payloadObserver?.disconnect();
    this.#payloadObserver = undefined;
    if (this.#payloadTimeout !== undefined) {
      window.clearTimeout(this.#payloadTimeout);
      this.#payloadTimeout = undefined;
    }
  }
}

export function defineMarimoMdxIsland(
  name = defaultMarimoElementName,
): CustomElementConstructor | undefined {
  if (typeof customElements === "undefined") return undefined;
  const existing = customElements.get(name);
  if (existing) return existing;
  customElements.define(name, MarimoMdxIslandElement);
  return MarimoMdxIslandElement;
}

function readOutput(host: HTMLElement): MarimoOutput | undefined {
  const source = readOutputSource(host);
  if (!source) return undefined;
  const output: unknown = JSON.parse(source);
  if (isMarimoOutput(output)) return output;
  throw new Error("Invalid marimo output payload");
}

function readOutputSource(host: HTMLElement): string | undefined {
  const hostAttribute = host.getAttribute("data-marimo-output");
  if (hostAttribute) return hostAttribute;

  const template = host.querySelector("template[data-marimo-output]");
  const attribute = template?.getAttribute("data-marimo-output");
  if (attribute) return attribute;
  const source =
    template instanceof HTMLTemplateElement ? template.content.textContent : template?.textContent;
  return source || undefined;
}

function isMarimoOutput(value: unknown): value is MarimoOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Partial<MarimoOutput>;
  return (
    typeof output.html === "string" &&
    typeof output.appId === "string" &&
    typeof output.cellIndex === "number" &&
    typeof output.runtimeCellCount === "number"
  );
}

function themeFromElement(host: HTMLElement): "auto" | "light" | "dark" {
  const theme = host.getAttribute("data-marimo-theme-mode");
  return theme === "light" || theme === "dark" ? theme : "auto";
}
