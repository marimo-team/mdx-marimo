import { ensureDocumentNavigation } from "../browser/navigation";
import { defineMarimoMdxIsland } from "./index";

defineMarimoMdxIsland();

if (typeof document !== "undefined") {
  ensureDocumentNavigation();
}
