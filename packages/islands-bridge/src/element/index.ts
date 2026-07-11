import { mountMarimoIsland, renderMarimoIslandError } from "../browser/island";
import { isMarimoPageCellPayload, type MarimoPageCellPayload } from "../protocol";

export type DefineMarimoIslandElementOptions = {
  name: string;
  host?: string;
};

export function defineMarimoIslandElement({
  name,
  host,
}: DefineMarimoIslandElementOptions): CustomElementConstructor | undefined {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined") return undefined;
  const existing = customElements.get(name);
  if (existing) return existing;
  const constructor = createMarimoIslandElementConstructor(host);
  customElements.define(name, constructor);
  return constructor;
}

function createMarimoIslandElementConstructor(
  hostKind: string | undefined,
): CustomElementConstructor {
  // Some host bundles downlevel dependency classes. This callable superclass
  // preserves native HTMLElement construction in those builds.
  function MarimoElementBase(this: HTMLElement): HTMLElement {
    return Reflect.construct(HTMLElement, [], this.constructor) as HTMLElement;
  }

  Object.setPrototypeOf(MarimoElementBase, HTMLElement);
  MarimoElementBase.prototype = HTMLElement.prototype;
  const ElementBase = MarimoElementBase as unknown as typeof HTMLElement;

  return class MarimoIslandElement extends ElementBase {
    static get observedAttributes(): string[] {
      return ["data-marimo-theme-mode"];
    }

    #cleanup: (() => void) | undefined;
    #mountQueued = false;
    #payload: MarimoPageCellPayload | undefined;
    #payloadObserver: MutationObserver | undefined;

    connectedCallback(): void {
      this.#queueMount();
    }

    disconnectedCallback(): void {
      this.#cleanup?.();
      this.#cleanup = undefined;
      this.#stopPayloadWait();
    }

    attributeChangedCallback(
      _name: string,
      oldValue: string | null,
      newValue: string | null,
    ): void {
      if (oldValue === newValue) return;
      if (this.isConnected && this.#payload) this.#queueMount();
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
        this.#payload = this.#payload ?? readPayload(this);
        if (!this.#payload) {
          this.#waitForPayload();
          return;
        }
        this.#stopPayloadWait();
        this.#cleanup?.();
        this.#cleanup = mountMarimoIsland(this, this.#payload, {
          ...(hostKind ? { host: hostKind } : {}),
          theme: themeFromElement(this),
        });
      } catch (error: unknown) {
        this.#cleanup?.();
        this.#cleanup = undefined;
        this.#stopPayloadWait();
        this.classList.add("marimo-island-host");
        if (hostKind) this.dataset.marimoHost = hostKind;
        this.innerHTML = "";
        renderMarimoIslandError(this, error);
      }
    }

    #waitForPayload(): void {
      if (this.#payloadObserver || typeof MutationObserver === "undefined") return;
      this.#payloadObserver = new MutationObserver(() => {
        if (readPayloadSource(this)) this.#queueMount();
      });
      this.#payloadObserver.observe(this, { childList: true, subtree: true });
    }

    #stopPayloadWait(): void {
      this.#payloadObserver?.disconnect();
      this.#payloadObserver = undefined;
    }
  };
}

function readPayload(host: HTMLElement): MarimoPageCellPayload | undefined {
  const source = readPayloadSource(host);
  if (!source) return undefined;
  const payload: unknown = JSON.parse(source);
  if (isMarimoPageCellPayload(payload)) return payload;
  throw new Error("Invalid marimo page cell payload");
}

function readPayloadSource(host: HTMLElement): string | undefined {
  const attribute = host.getAttribute("data-marimo-payload");
  if (attribute) {
    const encoding = host.getAttribute("data-marimo-payload-encoding");
    return encoding === "base64url" ? decodeBase64Url(attribute) : attribute;
  }
  const template = host.querySelector("template[data-marimo-payload]");
  const templateAttribute = template?.getAttribute("data-marimo-payload");
  if (templateAttribute) return templateAttribute;
  const source =
    template instanceof HTMLTemplateElement ? template.content.textContent : template?.textContent;
  return source || undefined;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function themeFromElement(host: HTMLElement): "auto" | "light" | "dark" {
  const theme = host.getAttribute("data-marimo-theme-mode");
  return theme === "light" || theme === "dark" ? theme : "auto";
}
