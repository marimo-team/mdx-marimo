import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";

export default function Root({ children }) {
  return (
    <>
      {children}
      <MarimoIslandRuntime />
    </>
  );
}
