import { mountMarimoIsland, renderMarimoIslandError } from "../browser/island";
import {
  isMarimoPageCellPayload,
  isMarimoPageCellReferencePayload,
  type MarimoPageCellPayload,
  type MarimoPageCellReferencePayload,
  type MarimoPageRuntime,
  type MarimoPageSerializedCellPayload,
} from "../protocol";

export type DefineMarimoIslandElementOptions = {
  name: string;
  host?: string;
};

type RegisteredPageApp = {
  app: MarimoPageRuntime;
  owners: Set<object>;
};

const pageApps = new Map<string, RegisteredPageApp>();
const pageAppWaiters = new Map<string, Set<() => void>>();

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
    #appRegistration: { app: MarimoPageRuntime; release: () => void } | undefined;
    #cleanupAppWait: (() => void) | undefined;
    #mountQueued = false;
    #payload: MarimoPageCellPayload | undefined;
    #payloadObserver: MutationObserver | undefined;
    #serializedPayload: MarimoPageSerializedCellPayload | undefined;

    connectedCallback(): void {
      this.#queueMount();
    }

    disconnectedCallback(): void {
      this.#cleanup?.();
      this.#cleanup = undefined;
      this.#stopAppRegistration();
      this.#stopAppWait();
      this.#stopPayloadWait();
      if (this.#serializedPayload && isMarimoPageCellReferencePayload(this.#serializedPayload)) {
        this.#payload = undefined;
      }
    }

    attributeChangedCallback(
      _name: string,
      oldValue: string | null,
      newValue: string | null,
    ): void {
      if (oldValue === newValue) return;
      if (this.isConnected && (this.#payload || this.#serializedPayload)) this.#queueMount();
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
        this.#serializedPayload = this.#serializedPayload ?? readPayload(this);
        if (!this.#serializedPayload) {
          this.#waitForPayload();
          return;
        }

        this.#registerSerializedApp();
        this.#payload = this.#payload ?? resolvePayload(this.#serializedPayload);
        if (!this.#payload) {
          const reference = this.#serializedPayload;
          if (!isMarimoPageCellReferencePayload(reference)) {
            throw new Error("Invalid marimo page cell reference");
          }
          this.#cleanup ??= mountMarimoIsland(this, staticPayload(reference), {
            ...(hostKind ? { host: hostKind } : {}),
            theme: themeFromElement(this),
          });
          this.#waitForApp(reference.appId);
          return;
        }

        this.#stopAppWait();
        this.#stopPayloadWait();
        this.#cleanup?.();
        this.#cleanup = mountMarimoIsland(this, this.#payload, {
          ...(hostKind ? { host: hostKind } : {}),
          theme: themeFromElement(this),
        });
      } catch (error: unknown) {
        this.#cleanup?.();
        this.#cleanup = undefined;
        this.#stopAppWait();
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

    #waitForApp(appId: string): void {
      if (this.#cleanupAppWait) return;
      this.#cleanupAppWait = waitForPageApp(appId, () => {
        this.#cleanupAppWait = undefined;
        this.#queueMount();
      });
    }

    #registerSerializedApp(): void {
      const serialized = this.#serializedPayload;
      if (!serialized || !isMarimoPageCellPayload(serialized) || !serialized.app) return;
      if (this.#appRegistration?.app === serialized.app) return;

      this.#stopAppRegistration();
      this.#appRegistration = {
        app: serialized.app,
        release: registerPageApp(serialized.app, this),
      };
    }

    #stopAppRegistration(): void {
      this.#appRegistration?.release();
      this.#appRegistration = undefined;
    }

    #stopAppWait(): void {
      this.#cleanupAppWait?.();
      this.#cleanupAppWait = undefined;
    }

    #stopPayloadWait(): void {
      this.#payloadObserver?.disconnect();
      this.#payloadObserver = undefined;
    }
  };
}

function readPayload(host: HTMLElement): MarimoPageSerializedCellPayload | undefined {
  const source = readPayloadSource(host);
  if (!source) return undefined;
  const payload: unknown = JSON.parse(source);
  if (isMarimoPageCellPayload(payload) || isMarimoPageCellReferencePayload(payload)) return payload;
  throw new Error("Invalid marimo page cell payload");
}

function resolvePayload(
  payload: MarimoPageSerializedCellPayload,
): MarimoPageCellPayload | undefined {
  if (isMarimoPageCellPayload(payload)) {
    return payload;
  }

  const registration = pageApps.get(payload.appId);
  if (!registration) return undefined;
  return {
    protocolVersion: payload.protocolVersion,
    app: registration.app,
    cell: payload.cell,
  };
}

function staticPayload(payload: MarimoPageCellReferencePayload): MarimoPageCellPayload {
  return {
    protocolVersion: payload.protocolVersion,
    app: null,
    cell: payload.cell,
  };
}

function registerPageApp(app: MarimoPageRuntime, owner: object): () => void {
  let registration = pageApps.get(app.id);
  if (!registration || registration.app !== app) {
    registration = { app, owners: new Set() };
    pageApps.set(app.id, registration);
  }
  registration.owners.add(owner);
  const waiters = pageAppWaiters.get(app.id);
  if (waiters) {
    pageAppWaiters.delete(app.id);
    for (const waiter of waiters) waiter();
  }

  return () => {
    if (pageApps.get(app.id) !== registration) return;
    registration.owners.delete(owner);
    if (registration.owners.size === 0) pageApps.delete(app.id);
  };
}

function waitForPageApp(appId: string, mount: () => void): () => void {
  const waiters = pageAppWaiters.get(appId) ?? new Set<() => void>();
  waiters.add(mount);
  pageAppWaiters.set(appId, waiters);
  return () => {
    waiters.delete(mount);
    if (waiters.size === 0) pageAppWaiters.delete(appId);
  };
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
