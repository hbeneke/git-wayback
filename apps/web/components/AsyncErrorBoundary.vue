<template>
  <Suspense>
    <template #default>
      <ErrorBoundary
        :title="title"
        :message="message"
        :icon="icon"
        :show-retry="showRetry"
        @error="$emit('error', $event)"
        @reset="$emit('reset')"
      >
        <slot />
      </ErrorBoundary>
    </template>
    <template #fallback>
      <slot name="loading">
        <div class="py-12 text-center">
          <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin mb-3" />
          <p class="text-xs text-[rgb(var(--muted))]">{{ loadingText }}</p>
        </div>
      </slot>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  message?: string
  icon?: string
  showRetry?: boolean
  loadingText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again.',
  icon: '⚠️',
  showRetry: true,
  loadingText: 'Loading...',
})

defineEmits<{
  error: [error: Error]
  reset: []
}>()
</script>
