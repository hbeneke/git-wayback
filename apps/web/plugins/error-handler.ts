/**
 * Global error handler plugin.
 * Catches unhandled errors and provides centralized error handling.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // Handle Vue errors
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    // In development, log detailed error info
    if (import.meta.dev) {
      console.error('[Vue Error]', { error, instance, info })
    }

    // Could integrate with error tracking service here
    // e.g., Sentry, LogRocket, etc.
  }

  // Handle unhandled promise rejections
  if (import.meta.client) {
    window.addEventListener('unhandledrejection', (event) => {
      if (import.meta.dev) {
        console.error('[Unhandled Promise Rejection]', event.reason)
      }
    })
  }
})
