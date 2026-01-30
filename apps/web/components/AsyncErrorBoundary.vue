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
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div
              class="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full mx-auto mb-3"
            />
            <p class="text-gray-500 text-sm">{{ loadingText }}</p>
          </div>
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
