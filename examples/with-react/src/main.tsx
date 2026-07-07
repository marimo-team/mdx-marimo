import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MDXProvider } from "@mdx-js/react";
import "@marimo-team/mdx-marimo/styles.css";
import Content from "./content.mdx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MDXProvider>
      <Content />
    </MDXProvider>
  </StrictMode>,
);
