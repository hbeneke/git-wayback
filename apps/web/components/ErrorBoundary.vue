<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary">
    <slot name="fallback" :error="error" :reset="reset">
      <div class="py-8 text-center">
        <h3 class="text-sm font-semibold mb-1">{{ title }}</h3>
        <p class="text-xs text-[rgb(var(--muted))] mb-3">{{ message }}</p>
        <button
          v-if="showRetry"
          @click="reset"
          class="text-xs link-primary"
        >
          Try again
        </button>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  message?: string
  icon?: string
  showRetry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again.',
  icon: '⚠️',
  showRetry: true,
})

const emit = defineEmits<{
  error: [error: Error]
  reset: []
}>()

const error = ref<Error | null>(null)
const hasError = ref(false)

function reset() {
  error.value = null
  hasError.value = false
  emit('reset')
}

onErrorCaptured((err: Error) => {
  error.value = err
  hasError.value = true
  emit('error', err)

  // Return false to prevent the error from propagating
  return false
})

defineExpose({
  reset,
  hasError,
  error,
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
}
</style>
