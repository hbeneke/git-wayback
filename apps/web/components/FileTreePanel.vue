<template>
  <ul class="list-none p-0 m-0 text-[11px] font-mono">
    <li
      v-for="node in sortedNodes"
      :key="node.path || node.name"
    >
      <button
        type="button"
        class="w-full flex items-center gap-1.5 py-0.5 pr-2 text-left bg-transparent border-0 cursor-pointer rounded-sm transition-all duration-[250ms]"
        :class="isHighlighted(node)
          ? 'bg-[rgb(var(--primary)/0.18)] shadow-[inset_2px_0_0_rgb(var(--primary))]'
          : 'hover:bg-[rgb(var(--border)/0.4)]'"
        :style="{ paddingLeft: `${depth * 10 + 6}px` }"
        :data-path="node.path || node.name"
        @mouseenter="$emit('hover', node.path || node.name)"
        @mouseleave="$emit('hover', null)"
        @click.stop="onClick(node)"
      >
        <span
          v-if="node.type === 'folder'"
          class="w-[10px] h-[10px] inline-flex items-center justify-center text-[rgb(var(--muted))] transition-transform duration-[120ms] shrink-0"
          :class="isOpen(node) ? 'rotate-90' : ''"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M2 1l4 3-4 3z" />
          </svg>
        </span>
        <span v-else class="w-[10px] shrink-0" />

        <span
          class="w-[7px] h-[7px] rounded-full shrink-0"
          :style="{ backgroundColor: node.type === 'folder' ? 'rgb(16, 185, 129)' : getExtensionColor(node.extension || null) }"
        />

        <span
          class="truncate transition-colors duration-[250ms]"
          :class="[
            node.type === 'folder' ? 'font-semibold' : '',
            isHighlighted(node) ? 'text-[rgb(var(--primary))]' : 'text-[rgb(var(--foreground))]',
          ]"
        >{{ node.name }}</span>
      </button>

      <FileTreePanel
        v-if="node.type === 'folder' && isOpen(node) && node.children.length"
        :nodes="node.children"
        :depth="depth + 1"
        :open-set="openSet"
        :highlighted-path="highlightedPath"
        @hover="(p) => $emit('hover', p)"
        @click="(p) => $emit('click', p)"
        @toggle="(p) => $emit('toggle', p)"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useDiagramTree'
import { getExtensionColor } from '~/composables/useDiagramTree'

const props = withDefaults(defineProps<{
  nodes: TreeNode[]
  depth?: number
  openSet: Set<string>
  highlightedPath?: string | null
}>(), {
  depth: 0,
  highlightedPath: null,
})

const emit = defineEmits<{
  hover: [path: string | null]
  click: [path: string]
  toggle: [path: string]
}>()

const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
})

function isOpen(node: TreeNode): boolean {
  return props.openSet.has(node.path || node.name)
}

function isHighlighted(node: TreeNode): boolean {
  return !!props.highlightedPath && (node.path || node.name) === props.highlightedPath
}

function onClick(node: TreeNode) {
  if (node.type === 'folder') {
    emit('toggle', node.path || node.name)
  } else {
    emit('click', node.path || node.name)
  }
}
</script>
