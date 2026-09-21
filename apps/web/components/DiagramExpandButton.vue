<template>
  <button
    type="button"
    class="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded border cursor-pointer transition-colors bg-bg/60"
    :class="expanded
      ? 'border-primary text-primary hover:bg-primary hover:text-[rgb(var(--bg))]'
      : 'border-[rgb(var(--border))] text-fg hover:border-primary hover:text-primary'"
    :aria-label="expanded ? 'Exit fullscreen' : 'Fullscreen'"
    :title="expanded ? 'Exit fullscreen (F / Esc)' : 'Fullscreen (F)'"
    @click.stop="emit('toggle')"
  >
    <svg v-if="!expanded" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 1h4v4 M11 1 7 5 M5 11H1V7 M1 11l4-4" />
    </svg>
    <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 1 7 5m0 0V1m0 4h4 M1 11l4-4m0 0v4m0-4H1" />
    </svg>
    <span class="hidden sm:inline">{{ expanded ? 'Exit' : 'Fullscreen' }}</span>
    <kbd class="hidden sm:inline text-[10px] leading-none px-1 py-0.5 rounded border border-[rgb(var(--border))] opacity-70 font-mono">F</kbd>
  </button>
</template>

<script setup lang="ts">
defineProps<{ expanded: boolean }>()
const emit = defineEmits<{ (e: 'toggle'): void }>()
</script>
