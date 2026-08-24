<template>
  <div
    class="logo-container flex items-center justify-center overflow-hidden transition-all duration-300 hover:ring-1 hover:ring-[rgb(var(--secondary)/.3)]"
    :class="[size, rounded]"
  >
    <img src="/favicon.svg" alt="" class="flower w-full h-full" :class="rounded">
  </div>
</template>

<script setup lang="ts">
/**
 * Tailwind sizing/rounding classes for the mark — the header shrinks it on
 * scroll, where it matches the portfolio listing on personal-site (w-5 h-5,
 * `rounded`).
 */
withDefaults(
  defineProps<{ size?: string; rounded?: string }>(),
  { size: 'w-16 h-16', rounded: 'rounded-lg' }
)
</script>

<style scoped>
.logo-container:hover .flower {
  animation: bloom 8s linear infinite;
}

@keyframes bloom {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .logo-container:hover .flower {
    animation: none;
  }
}
</style>
