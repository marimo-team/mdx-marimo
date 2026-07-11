import "@marimo-team/mdx-marimo/styles.css";
import { MarimoIslandRuntime } from "@marimo-team/mdx-marimo/react";
import "../../site.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <MarimoIslandRuntime />
    </>
  );
}
