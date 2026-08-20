<template>
  <!-- Nuxt renders this outside the router, so the layout is pulled in by hand
       to keep the header and footer. -->
  <NuxtLayout>
    <main class="max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-12">
      <h1 class="text-xl font-semibold leading-tight">
        <span class="text-5xl font-extrabold text-primary align-middle mr-2">{{ statusCode }}</span>
        <span class="align-middle">| {{ headline }}</span>
      </h1>

      <p class="text-sm text-[rgb(var(--muted))] mt-6">{{ blurb }}</p>

      <p v-if="isNotFound" class="text-sm text-[rgb(var(--muted))] mt-2">
        Nothing here to replay. Search for a repository, or
        <NuxtLink to="/" class="link-primary" @click.prevent="reset">check out the default branch</NuxtLink>.
      </p>
      <p v-else class="text-sm text-[rgb(var(--muted))] mt-2">
        Try again in a moment, or
        <NuxtLink to="/" class="link-primary" @click.prevent="reset">head back home</NuxtLink>.
      </p>

      <!-- The real message stays available but out of the way: it is upstream
           wording (GitHub, rate limits), not something to lead with. -->
      <p v-if="props.error.message" class="text-xs text-[rgb(var(--muted))] mt-8 font-mono">
        {{ props.error.message }}
      </p>
    </main>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const statusCode = computed(() => props.error.statusCode || 500)
const isNotFound = computed(() => statusCode.value === 404)

const headline = computed(() => {
  if (isNotFound.value) return 'This commit never happened'
  if (statusCode.value === 429) return 'Slow down, the timeline is rewinding'
  return 'The history got corrupted'
})

const blurb = computed(() => {
  if (isNotFound.value) {
    return 'You are in detached HEAD state, pointing at a ref that no repository ever wrote.'
  }
  if (statusCode.value === 429) {
    return 'Too many requests in a short window. The rate limit resets on its own.'
  }
  return 'Something broke on the way back from the past.'
})

useSeoMeta({
  title: isNotFound.value ? 'Page not found - git-wayback' : 'Error - git-wayback',
  description: 'The page you are looking for does not exist.',
})

// Without this the error state survives the navigation and the page renders again.
function reset() {
  clearError({ redirect: '/' })
}
</script>
