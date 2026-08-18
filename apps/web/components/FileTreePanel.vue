<template>
  <div
    ref="scroller"
    class="overflow-y-auto overflow-x-hidden"
    @scroll.passive="onScroll"
  >
    <div :style="{ height: `${rows.length * ROW_H}px`, position: 'relative' }">
      <div :style="{ transform: `translateY(${start * ROW_H}px)` }">
        <button
          v-for="row in visibleRows"
          :key="row.key"
          type="button"
          class="w-full flex items-center gap-1.5 pr-2 text-left bg-transparent border-0 cursor-pointer rounded-sm text-[11px] font-mono"
          :class="row.key === highlightedPath
            ? 'bg-[rgb(var(--primary)/0.18)] shadow-[inset_2px_0_0_rgb(var(--primary))]'
            : 'hover:bg-[rgb(var(--border)/0.4)]'"
          :style="{ height: `${ROW_H}px`, paddingLeft: `${row.depth * 10 + 6}px` }"
          :data-path="row.key"
          @mouseenter="$emit('hover', row.key)"
          @mouseleave="$emit('hover', null)"
          @click.stop="onClick(row)"
        >
          <span
            v-if="row.node.type === 'folder'"
            class="w-[10px] h-[10px] inline-flex items-center justify-center text-[rgb(var(--muted))] transition-transform duration-[120ms] shrink-0"
            :class="row.open ? 'rotate-90' : ''"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
              <path d="M2 1l4 3-4 3z" />
            </svg>
          </span>
          <span v-else class="w-[10px] shrink-0" />

          <span
            class="w-[7px] h-[7px] rounded-full shrink-0"
            :style="{ backgroundColor: row.color }"
          />

          <span
            class="truncate"
            :class="[
              row.node.type === 'folder' ? 'font-semibold' : '',
              row.key === highlightedPath ? 'text-[rgb(var(--primary))]' : 'text-[rgb(var(--foreground))]',
            ]"
          >{{ row.node.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useDiagramTree'
import { getExtensionColor } from '~/composables/useDiagramTree'

const ROW_H = 18
const OVERSCAN = 8
const FOLDER_COLOR = 'rgb(16, 185, 129)'

interface Row {
  key: string
  node: TreeNode
  depth: number
  open: boolean
  color: string
}

const props = withDefaults(defineProps<{
  nodes: TreeNode[]
  openSet: Set<string>
  highlightedPath?: string | null
}>(), {
  highlightedPath: null,
})

const emit = defineEmits<{
  hover: [path: string | null]
  click: [path: string]
  toggle: [path: string]
}>()

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewport = ref(240)

// Sorted children are memoised per node: flattening runs on every open/close.
const sortCache = new WeakMap<TreeNode[], TreeNode[]>()
function sorted(children: TreeNode[]): TreeNode[] {
  let out = sortCache.get(children)
  if (!out) {
    out = [...children].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    sortCache.set(children, out)
  }
  return out
}

// One flat array of open rows — the tree used to be a Vue component per node.
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const walk = (children: TreeNode[], depth: number) => {
    for (const node of sorted(children)) {
      const key = node.path || node.name
      const open = node.type === 'folder' && props.openSet.has(key)
      out.push({
        key,
        node,
        depth,
        open,
        color: node.type === 'folder' ? FOLDER_COLOR : getExtensionColor(node.extension || null),
      })
      if (open && node.children.length) walk(node.children, depth + 1)
    }
  }
  walk(props.nodes, 0)
  return out
})

const start = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN))
const visibleRows = computed(() =>
  rows.value.slice(start.value, start.value + Math.ceil(viewport.value / ROW_H) + OVERSCAN * 2),
)

function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0
}

function onClick(row: Row) {
  if (row.node.type === 'folder') emit('toggle', row.key)
  else emit('click', row.key)
}

/** Brings a path into view; the row may not be mounted, so scroll by index. */
function scrollToPath(path: string) {
  const i = rows.value.findIndex((r) => r.key === path)
  const el = scroller.value
  if (i < 0 || !el) return
  const top = i * ROW_H
  if (top < el.scrollTop || top + ROW_H > el.scrollTop + el.clientHeight) {
    el.scrollTop = top - el.clientHeight / 2
  }
}

let observer: ResizeObserver | null = null
onMounted(() => {
  const el = scroller.value
  if (!el) return
  viewport.value = el.clientHeight
  observer = new ResizeObserver(() => {
    viewport.value = el.clientHeight
  })
  observer.observe(el)
})

onUnmounted(() => observer?.disconnect())

defineExpose({ scrollToPath })
</script>
