import { withBasePath } from "@/lib/base-path";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  useEffect(() => {
    window.location.replace(withBasePath("/docs/"));
  }, []);

  return null;
}
