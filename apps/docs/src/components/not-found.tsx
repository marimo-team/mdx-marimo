import { baseOptions } from "@/lib/layout.shared";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";
import { HomeLayout } from "fumadocs-ui/layouts/home";

export function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <DefaultNotFound />
    </HomeLayout>
  );
}
