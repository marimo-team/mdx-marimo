export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    window.setTimeout(() => {
      void import("@marimo-team/mdx-marimo/element/auto");
    }, 0);
  });
});
