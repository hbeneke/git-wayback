<template>
  <div
    class="inline-block rounded-full border-[rgb(var(--border))] border-t-primary animate-spin"
    :class="SIZES[size]"
    role="status"
    :aria-label="label"
  />
</template>

<script setup lang="ts">
/**
 * The single loading indicator for the app. Swap the markup here and every
 * spinner changes with it — callers only pick a size.
 */
withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg'
    label?: string
  }>(),
  { size: 'md', label: 'Loading' }
)

// Written out in full so Tailwind's scanner sees each class.
const SIZES = {
  xs: 'w-3 h-3 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
} as const
</script>
