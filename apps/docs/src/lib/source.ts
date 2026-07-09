import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { docsRoute } from "@/lib/shared";

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
});

export function getPageDirectory(path: string) {
  return path.split("/").slice(0, -1);
}
