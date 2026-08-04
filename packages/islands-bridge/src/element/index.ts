import {
  assertCurrentDocument,
  mountMarimoIsland,
  reconnectMarimoIsland,
  renderMarimoIslandError,
} from "../browser/island";
import { type MarimoThemeMode, type MarimoThemeResolver } from "../browser/theme";
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
  themeResolver?: MarimoThemeResolver;
};

export type MarimoIslandElement = HTMLElement & {
  payload: MarimoPageSerializedCellPayload | undefined;
};

export type MountMarimoIslandElementOptions = DefineMarimoIslandElementOptions & {
  releaseDelayFrames?: number;
  retentionKey?: string;
  theme?: MarimoThemeMode;
};

export type MarimoIslandElementMount = {
  element: MarimoIslandElement;
  release: () => void;
};

type RegisteredPageApp = {
  app: MarimoPageRuntime;
  owners: Set<object>;
};

type PageAppDocumentState = {
  apps: Map<string, RegisteredPageApp>;
  waiters: Map<string, Set<() => void>>;
};

type RetainedElementMount = {
  cancelRelease?: () => void;
  element: RetainableMarimoIslandElement;
  host: ElementMountHost;
  payloadRevision: string;
  registryKey?: string;
};

type RetainableMarimoIslandElement = MarimoIslandElement & {
  [elementRetentionSymbol]?: RetainedElementMount;
  [finishRetainedReleaseSymbol]?: () => void;
};

type ElementMountHost = HTMLElement & {
  [elementMountSymbol]?: RetainedElementMount;
};

type ElementMountDocument = Document & {
  [elementMountRegistrySymbol]?: Map<string, RetainedElementMount>;
  [pageAppRegistrySymbol]?: PageAppDocumentState;
};

const elementMountSymbol = Symbol.for("@marimo-team/islands-bridge/element-mount");
const elementMountRegistrySymbol = Symbol.for("@marimo-team/islands-bridge/element-mount-registry");
const pageAppRegistrySymbol = Symbol.for("@marimo-team/islands-bridge/page-app-registry");
const elementRetentionSymbol = Symbol.for("@marimo-team/islands-bridge/element-retention");
const finishRetainedReleaseSymbol = Symbol.for(
  "@marimo-team/islands-bridge/finish-retained-release",
);

export function defineMarimoIslandElement({
  name,
  host,
  themeResolver,
}: DefineMarimoIslandElementOptions): CustomElementConstructor | undefined {
  if (typeof customElements === "undefined" || typeof HTMLElement === "undefined") return undefined;
  const existing = customElements.get(name);
  if (existing) return existing;
  const constructor = createMarimoIslandElementConstructor(host, themeResolver);
  customElements.define(name, constructor);
  return constructor;
}

export function mountMarimoIslandElement(
  parent: HTMLElement,
  payload: MarimoPageSerializedCellPayload,
  options: MountMarimoIslandElementOptions,
): MarimoIslandElementMount {
  assertCurrentDocument(parent);
  const releaseDelayFrames = options.releaseDelayFrames ?? 0;
  if (!Number.isInteger(releaseDelayFrames) || releaseDelayFrames < 0) {
    throw new TypeError("releaseDelayFrames must be a non-negative integer");
  }
  const constructor = defineMarimoIslandElement(options);
  if (!constructor) {
    throw new Error("Custom elements are unavailable");
  }

  const host = parent as ElementMountHost;
  const registry = elementMountRegistry(parent.ownerDocument);
  const retentionKey = options.retentionKey ?? payloadRetentionKey(payload);
  const registryKey = retentionKey ? `${options.name}\0${retentionKey}` : undefined;
  const hostMount = host[elementMountSymbol];
  let previous = (registryKey ? registry.get(registryKey) : undefined) ?? hostMount;
  if (hostMount && hostMount !== previous) disposeRetainedMount(hostMount, registry);
  const payloadRevision = JSON.stringify(payload);
  if (previous && previous.payloadRevision !== payloadRevision) {
    disposeRetainedMount(previous, registry);
    previous = undefined;
  }
  previous?.cancelRelease?.();
  if (
    previous?.registryKey &&
    previous.registryKey !== registryKey &&
    registry.get(previous.registryKey) === previous
  ) {
    registry.delete(previous.registryKey);
  }

  let element = previous?.element;
  if (!element) {
    element = parent.ownerDocument.createElement(options.name) as RetainableMarimoIslandElement;
    element.payload = payload;
  }
  element.dataset.marimoThemeMode = options.theme ?? "auto";
  if (element.parentElement !== parent) parent.append(element);

  if (previous && previous.host !== host && previous.host[elementMountSymbol] === previous) {
    delete previous.host[elementMountSymbol];
  }

  const state: RetainedElementMount = {
    element,
    host,
    payloadRevision,
    ...(registryKey ? { registryKey } : {}),
  };
  host[elementMountSymbol] = state;
  element[elementRetentionSymbol] = state;
  if (registryKey) registry.set(registryKey, state);

  return {
    element,
    release: () => {
      if (host[elementMountSymbol] !== state) return;
      const finishRelease = () => {
        const current = registryKey ? registry.get(registryKey) : host[elementMountSymbol];
        if (current !== state) return;
        disposeRetainedMount(state, registry);
      };
      if (releaseDelayFrames === 0) {
        finishRelease();
        return;
      }
      const cancelFrames = afterAnimationFrames(releaseDelayFrames, finishRelease);
      const cancelRelease = () => {
        cancelFrames();
        if (state.cancelRelease === cancelRelease) delete state.cancelRelease;
      };
      state.cancelRelease = cancelRelease;
    },
  };
}

function createMarimoIslandElementConstructor(
  hostKind: string | undefined,
  themeResolver: MarimoThemeResolver | undefined,
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
    #cleanup: (() => void) | undefined;
    #appRegistration: { app: MarimoPageRuntime; release: () => void } | undefined;
    #cleanupAppWait: (() => void) | undefined;
    #disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    #mountQueued = false;
    #payload: MarimoPageCellPayload | undefined;
    #payloadObserver: MutationObserver | undefined;
    #retainedDisconnect = false;
    #serializedPayload: MarimoPageSerializedCellPayload | undefined;

    get payload(): MarimoPageSerializedCellPayload | undefined {
      return this.#serializedPayload;
    }

    set payload(payload: MarimoPageSerializedCellPayload | undefined) {
      if (
        payload !== undefined &&
        !isMarimoPageCellPayload(payload) &&
        !isMarimoPageCellReferencePayload(payload)
      ) {
        throw new TypeError("Invalid marimo page cell payload");
      }
      if (payload === this.#serializedPayload) return;

      this.#cleanup?.();
      this.#cleanup = undefined;
      this.#stopAppRegistration();
      this.#stopAppWait();
      this.#stopPayloadWait();
      this.#serializedPayload = payload;
      this.#payload = undefined;
      if (this.isConnected && payload) this.#queueMount();
    }

    connectedCallback(): void {
      const retainedMount = this.#disconnectTimer !== undefined || this.#retainedDisconnect;
      if (this.#disconnectTimer !== undefined) {
        clearTimeout(this.#disconnectTimer);
        this.#disconnectTimer = undefined;
      }
      this.#retainedDisconnect = false;
      if (retainedMount && this.#cleanup) {
        reconnectMarimoIsland(this);
      } else {
        this.#queueMount();
      }
    }

    disconnectedCallback(): void {
      if (this.#disconnectTimer !== undefined) clearTimeout(this.#disconnectTimer);
      this.#disconnectTimer = setTimeout(() => {
        this.#disconnectTimer = undefined;
        const retained = (this as RetainableMarimoIslandElement)[elementRetentionSymbol];
        if (retained?.cancelRelease) {
          this.#retainedDisconnect = true;
          return;
        }
        this.#teardown();
      }, 0);
    }

    [finishRetainedReleaseSymbol](): void {
      if (this.isConnected) return;
      if (this.#disconnectTimer !== undefined) {
        clearTimeout(this.#disconnectTimer);
        this.#disconnectTimer = undefined;
      }
      this.#retainedDisconnect = false;
      this.#teardown();
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

        this.#payload =
          this.#payload ?? resolvePayload(this.ownerDocument, this.#serializedPayload);
        if (!this.#payload) {
          const reference = this.#serializedPayload;
          if (!isMarimoPageCellReferencePayload(reference)) {
            throw new Error("Invalid marimo page cell reference");
          }
          this.#cleanup ??= mountMarimoIsland(this, staticPayload(reference), {
            ...(hostKind ? { host: hostKind } : {}),
            ...(themeResolver ? { themeResolver } : {}),
          });
          this.#waitForApp(reference.appId);
          return;
        }

        if (this.#payload.app) this.#registerApp(this.#payload.app);
        this.#stopAppWait();
        this.#stopPayloadWait();
        this.#cleanup?.();
        this.#cleanup = mountMarimoIsland(this, this.#payload, {
          ...(hostKind ? { host: hostKind } : {}),
          ...(themeResolver ? { themeResolver } : {}),
        });
      } catch (error: unknown) {
        this.#cleanup?.();
        this.#cleanup = undefined;
        this.#stopAppRegistration();
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
      this.#cleanupAppWait = waitForPageApp(this.ownerDocument, appId, () => {
        this.#cleanupAppWait = undefined;
        this.#queueMount();
      });
    }

    #registerApp(app: MarimoPageRuntime): void {
      if (this.#appRegistration?.app === app) return;

      this.#stopAppRegistration();
      this.#appRegistration = {
        app,
        release: registerPageApp(this.ownerDocument, app, this),
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

    #teardown(): void {
      this.#cleanup?.();
      this.#cleanup = undefined;
      this.#stopAppRegistration();
      this.#stopAppWait();
      this.#stopPayloadWait();
      if (this.#serializedPayload && isMarimoPageCellReferencePayload(this.#serializedPayload)) {
        this.#payload = undefined;
      }
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
  document: Document,
  payload: MarimoPageSerializedCellPayload,
): MarimoPageCellPayload | undefined {
  if (isMarimoPageCellPayload(payload)) {
    return payload;
  }

  const registration = pageAppDocumentState(document).apps.get(payload.appId);
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

function registerPageApp(document: Document, app: MarimoPageRuntime, owner: object): () => void {
  const state = pageAppDocumentState(document);
  let registration = state.apps.get(app.id);
  if (!registration || registration.app !== app) {
    registration = { app, owners: new Set() };
    state.apps.set(app.id, registration);
  }
  registration.owners.add(owner);
  const waiters = state.waiters.get(app.id);
  if (waiters) {
    state.waiters.delete(app.id);
    for (const waiter of waiters) waiter();
  }

  return () => {
    if (state.apps.get(app.id) !== registration) return;
    registration.owners.delete(owner);
    if (registration.owners.size === 0) state.apps.delete(app.id);
  };
}

function waitForPageApp(document: Document, appId: string, mount: () => void): () => void {
  const state = pageAppDocumentState(document);
  const waiters = state.waiters.get(appId) ?? new Set<() => void>();
  waiters.add(mount);
  state.waiters.set(appId, waiters);
  return () => {
    waiters.delete(mount);
    if (waiters.size === 0) state.waiters.delete(appId);
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

function payloadRetentionKey(payload: MarimoPageSerializedCellPayload): string | undefined {
  const appId = isMarimoPageCellPayload(payload) ? payload.app?.id : payload.appId;
  return appId ? `${appId}:${payload.cell.index}` : undefined;
}

function disposeRetainedMount(
  state: RetainedElementMount,
  registry: Map<string, RetainedElementMount>,
): void {
  state.cancelRelease?.();
  delete state.cancelRelease;
  state.element.remove();
  state.element[finishRetainedReleaseSymbol]?.();
  if (state.host[elementMountSymbol] === state) delete state.host[elementMountSymbol];
  if (state.registryKey && registry.get(state.registryKey) === state) {
    registry.delete(state.registryKey);
  }
  if (state.element[elementRetentionSymbol] === state) {
    delete state.element[elementRetentionSymbol];
  }
}

function elementMountRegistry(document: Document): Map<string, RetainedElementMount> {
  const owner = document as ElementMountDocument;
  return (owner[elementMountRegistrySymbol] ??= new Map());
}

function pageAppDocumentState(document: Document): PageAppDocumentState {
  const owner = document as ElementMountDocument;
  return (owner[pageAppRegistrySymbol] ??= {
    apps: new Map(),
    waiters: new Map(),
  });
}

function afterAnimationFrames(frameCount: number, callback: () => void): () => void {
  if (frameCount === 0) {
    callback();
    return () => {};
  }

  let active = true;
  let handle: number | undefined;
  const advance = (remaining: number) => {
    handle = globalThis.requestAnimationFrame(() => {
      if (!active) return;
      if (remaining === 1) {
        callback();
      } else {
        advance(remaining - 1);
      }
    });
  };
  advance(frameCount);
  return () => {
    active = false;
    if (handle !== undefined) globalThis.cancelAnimationFrame(handle);
  };
}
