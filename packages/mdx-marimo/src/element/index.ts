import {
  defineMarimoIslandElement as defineBridgeIslandElement,
  type DefineMarimoIslandElementOptions,
} from "@marimo-team/islands-bridge/element";
import { defaultMarimoElementName } from "./name";

export { defaultMarimoElementName };

export function defineMarimoIslandElement(
  name = defaultMarimoElementName,
): CustomElementConstructor | undefined {
  const options: DefineMarimoIslandElementOptions = { name, host: "mdx" };
  return defineBridgeIslandElement(options);
}
