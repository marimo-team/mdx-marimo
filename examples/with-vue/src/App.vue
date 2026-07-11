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
