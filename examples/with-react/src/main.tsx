import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MDXProvider } from "@mdx-js/react";
import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";
import "@marimo-team/mdx-marimo/styles.css";
import "../../site.css";
import Content from "./content.mdx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MDXProvider>
      <main className="page">
        <Content />
      </main>
      <MarimoIslandRuntime />
    </MDXProvider>
  </StrictMode>,
);
