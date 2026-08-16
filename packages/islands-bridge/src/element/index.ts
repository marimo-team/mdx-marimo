import {
  assertCurrentDocument,
  mountMarimoIsland,
  reconnectMarimoIsland,
  renderMarimoIslandError,
} from "../browser/island";
import type { MarimoPageSerializedCellPayload } from "../protocol";
import {
  createMarimoIslandElementBridge,
  type DefineMarimoIslandElementOptions,
  type MarimoIslandElementMount,
  type MarimoIslandElementRuntime,
  type MountMarimoIslandElementOptions,
} from "./bridge";

export type {
  DefineMarimoIslandElementOptions,
  MarimoIslandElement,
  MarimoIslandElementMount,
  MountMarimoIslandElementOptions,
} from "./bridge";

const runtime = {
  assertCurrentDocument,
  mount: mountMarimoIsland,
  reconnect: reconnectMarimoIsland,
  renderError: renderMarimoIslandError,
} satisfies MarimoIslandElementRuntime;

const bridge = createMarimoIslandElementBridge(runtime);

export function defineMarimoIslandElement(
  options: DefineMarimoIslandElementOptions,
): CustomElementConstructor | undefined {
  return bridge.define(options);
}

export function mountMarimoIslandElement(
  parent: HTMLElement,
  payload: MarimoPageSerializedCellPayload,
  options: MountMarimoIslandElementOptions,
): MarimoIslandElementMount {
  return bridge.mount(parent, payload, options);
}
