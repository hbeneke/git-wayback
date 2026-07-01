<script setup lang="ts">
import { siteConfig } from "~/site.config";
</script>

<template>
  <ClientOnly>
    <site-footer
      :nickname="siteConfig.nickname"
      :year="siteConfig.copyrightYear"
      copyright="bugs"
      :style="{
        '--link': 'rgb(var(--primary))',
        '--link-hover': 'rgb(var(--primary-hovered))',
        '--accent': 'rgb(var(--secondary))',
      }"
    />
  </ClientOnly>
</template>
