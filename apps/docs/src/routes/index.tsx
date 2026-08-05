import { withBasePath } from "@/lib/base-path";
import { siteUrl } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRoute,
  head: () => ({
    links: [{ rel: "canonical", href: siteUrl }],
  }),
});

function IndexRoute() {
  useEffect(() => {
    window.location.replace(withBasePath("/docs/"));
  }, []);

  return null;
}
