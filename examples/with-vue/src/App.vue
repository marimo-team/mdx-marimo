<script setup lang="ts">
import { MDXProvider } from "@mdx-js/vue";
import Content from "./content.mdx";
</script>

<template>
  <main class="page">
    <MDXProvider>
      <Content />
    </MDXProvider>
  </main>
</template>

<style>
body {
  margin: 0;
  color: #171717;
  background: #ffffff;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 24px;
}

.page h1 {
  margin: 0 0 12px;
  font-size: 2rem;
  line-height: 1.15;
}

.page p {
  line-height: 1.6;
}
</style>
