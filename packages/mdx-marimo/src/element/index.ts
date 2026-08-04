import {
  defineMarimoIslandElement as defineBridgeIslandElement,
  type DefineMarimoIslandElementOptions,
} from "@marimo-team/mdx-marimo/bridge/element";
import { defaultMarimoElementName, mdxMarimoHost } from "./name";

export { defaultMarimoElementName };

export function defineMarimoIslandElement(
  name = defaultMarimoElementName,
): CustomElementConstructor | undefined {
  const options: DefineMarimoIslandElementOptions = {
    name,
    host: mdxMarimoHost,
  };
  return defineBridgeIslandElement(options);
}
