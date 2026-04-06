<template>
  <div>
    <!-- Tab buttons -->
    <nav class="flex gap-0 text-xs relative" style="margin-bottom: -1px;">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="modelValue !== tab.id && $emit('update:modelValue', tab.id)"
        :class="[
          'px-4 py-2 rounded-t border transition-colors relative',
          modelValue === tab.id
            ? 'bg-[rgb(var(--bg))] border-[rgb(var(--border))] border-b-[rgb(var(--bg))] text-primary font-bold z-10'
            : 'bg-[rgb(var(--border)/.15)] border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--border)/.25)]'
        ]"
      >
        {{ tab.label }}
        <span v-if="tab.badge" class="text-secondary ml-1">{{ tab.badge }}</span>
      </button>
    </nav>

    <!-- Panel -->
    <div class="border border-[rgb(var(--border))] rounded-b rounded-tr p-5">
      <div v-for="tab in tabs" :key="tab.id" v-show="modelValue === tab.id">
        <slot :name="tab.id" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  id: string
  label: string
  badge?: string
}

defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
