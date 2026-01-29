<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary">
    <slot name="fallback" :error="error" :reset="reset">
      <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p class="text-4xl mb-3">{{ icon }}</p>
        <h3 class="text-lg font-semibold text-red-800 mb-2">{{ title }}</h3>
        <p class="text-red-600 text-sm mb-4">{{ message }}</p>
        <button
          v-if="showRetry"
          @click="reset"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Try Again
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
