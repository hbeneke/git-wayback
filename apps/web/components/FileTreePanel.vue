<template>
  <ul class="file-tree" :class="{ 'is-root': depth === 0 }">
    <li
      v-for="node in sortedNodes"
      :key="node.path || node.name"
      class="file-tree-item"
    >
      <button
        type="button"
        class="file-tree-row"
        :class="{ 'is-highlighted': isHighlighted(node) }"
        :style="{ paddingLeft: `${depth * 10 + 6}px` }"
        :data-path="node.path || node.name"
        @mouseenter="$emit('hover', node.path || node.name)"
        @mouseleave="$emit('hover', null)"
        @click.stop="onClick(node)"
      >
        <span v-if="node.type === 'folder'" class="caret" :class="{ open: isOpen(node) }">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M2 1l4 3-4 3z" />
          </svg>
        </span>
        <span v-else class="caret-spacer" />

        <span
          class="dot"
          :style="{ backgroundColor: node.type === 'folder' ? 'rgb(16, 185, 129)' : getExtensionColor(node.extension || null) }"
        />

        <span class="label" :class="{ folder: node.type === 'folder' }">{{ node.name }}</span>
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

<style scoped>
.file-tree {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.file-tree-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 6px;
  text-align: left;
  color: rgb(var(--foreground));
  background: transparent;
  border: 0;
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
}

.file-tree-row:hover {
  background: rgb(var(--border) / 0.4);
}

.file-tree-row.is-highlighted {
  background: rgb(var(--primary) / 0.18);
  color: rgb(var(--primary));
  box-shadow: inset 2px 0 0 rgb(var(--primary));
}

.file-tree-row.is-highlighted .label {
  color: rgb(var(--primary));
}

.caret {
  width: 10px;
  height: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--muted));
  transition: transform 0.12s;
  flex-shrink: 0;
}

.caret.open {
  transform: rotate(90deg);
}

.caret-spacer {
  width: 10px;
  flex-shrink: 0;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.25s ease;
}

.label.folder {
  color: rgb(var(--foreground));
  font-weight: 600;
}
</style>
