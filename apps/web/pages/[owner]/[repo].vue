<template>
  <main>
    <h1>{{ owner }}/{{ repo }}</h1>
    <p>Repository analysis coming soon.</p>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
</script>
