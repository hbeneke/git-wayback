<template>
  <div>
    <!-- Tab buttons. shrink-0 + whitespace-nowrap on each button: the nav is a
         flex row, so without them a narrow viewport shrinks a button below its
         content width and the label wraps under the icon. -->
    <nav class="flex gap-0 text-xs relative -mb-px">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="modelValue !== tab.id && $emit('update:modelValue', tab.id)"
        :class="[
          'px-4 py-2 rounded-t border transition-colors relative inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap align-middle',
          modelValue === tab.id
            ? 'bg-[rgb(var(--bg))] border-[rgb(var(--border))] border-b-[rgb(var(--bg))] text-primary font-bold z-10'
            : 'bg-[rgb(var(--border)/.15)] border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--border)/.25)]'
        ]"
      >
        <svg
          v-if="tab.icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
          aria-hidden="true"
        >
          <path v-for="(d, i) in TAB_ICONS[tab.icon]" :key="i" :d="d" />
        </svg>
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
// Paths only, on a 24x24 grid, stroked with currentColor — same convention as
// the inline icons in RepoDiagram, so tabs inherit the active/muted color.
const TAB_ICONS = {
  doc: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  branch: [
    'M6 3v12',
    'M21 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    'M18 9a9 9 0 0 1-9 9',
  ],
  image: [
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    'M10 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
    'm4 16 4.5-4.5L20 20',
  ],
} as const

interface Tab {
  id: string
  label: string
  badge?: string
  icon?: keyof typeof TAB_ICONS
}

defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
