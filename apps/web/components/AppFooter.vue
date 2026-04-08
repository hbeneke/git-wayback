<script setup lang="ts">
import { siteConfig } from "~/site.config";
</script>

<template>
  <footer class="flex flex-col gap-y-2 pb-4 pt-20 text-center align-top font-semibold text-xs">
    <div class="group mx-auto px-4 py-2 transition-all duration-300 hover:rounded-lg hover:bg-[rgb(var(--border)/.1)]">
      <p>
        <a :href="siteConfig.siteUrl" target="_blank" class="link-primary underline-offset-2">
          {{ siteConfig.nickname }}
        </a>
      </p>
      <p class="text-[rgb(var(--muted))] mt-2">
        Copyright&copy; {{ siteConfig.copyrightYear }}. All bugs reserved.
      </p>
      <p
        class="text-[rgb(var(--muted))] opacity-100 transition-opacity duration-300 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 mt-2"
      >
        Made with <span class="text-secondary">&#10084;&#65039;</span> from Spain.
      </p>
    </div>
  </footer>
</template>
