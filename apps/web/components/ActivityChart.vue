<template>
  <div class="relative" @mouseleave="hoverIndex = null">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
      class="w-full block"
      :style="{ height: `${height}px` }"
      @mousemove="onMouseMove"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgb(var(--primary))" stop-opacity="0.35" />
          <stop offset="100%" stop-color="rgb(var(--primary))" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Area fill -->
      <path
        :d="areaPath"
        :fill="`url(#${gradientId})`"
      />

      <!-- Line -->
      <path
        :d="linePath"
        fill="none"
        stroke="rgb(var(--primary))"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />

      <!-- Hover guide -->
      <line
        v-if="hoverIndex !== null"
        :x1="coords[hoverIndex].x"
        :x2="coords[hoverIndex].x"
        :y1="0"
        :y2="height"
        stroke="rgb(var(--border))"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <!-- Hover dot (HTML overlay — avoids SVG aspect-ratio distortion) -->
    <div
      v-if="hoverIndex !== null"
      class="absolute w-1.5 h-1.5 rounded-full bg-primary ring-1 ring-[rgb(var(--bg))] pointer-events-none"
      :style="{
        left: `${(coords[hoverIndex].x / width) * 100}%`,
        top: `${coords[hoverIndex].y}px`,
        transform: 'translate(-50%, -50%)',
      }"
    />

    <!-- X-axis labels -->
    <div v-if="labels?.length" class="flex justify-between text-[10px] text-[rgb(var(--muted))] mt-1 px-0.5">
      <span v-for="(label, i) in labels" :key="i">{{ label }}</span>
    </div>

    <!-- Tooltip -->
    <div
      v-if="hoverIndex !== null"
      class="absolute pointer-events-none px-2 py-1 rounded text-[10px] bg-[rgb(var(--bg))] border border-[rgb(var(--border))] whitespace-nowrap z-10"
      :style="tooltipStyle"
    >
      <span class="text-[rgb(var(--muted))]">{{ tooltipLabel(hoverIndex) }}</span>
      <span class="ml-2 text-primary font-medium">{{ points[hoverIndex] }}</span>
      <span class="ml-1 text-[rgb(var(--muted))]">{{ valueSuffix }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  points: number[]
  labels?: string[]
  tooltipLabel?: (index: number) => string
  valueSuffix?: string
  height?: number
}>(), {
  labels: () => [],
  tooltipLabel: (i: number) => String(i),
  valueSuffix: 'commits',
  height: 56,
})

const width = 200
const padY = 4

const svgRef = ref<SVGSVGElement | null>(null)
const hoverIndex = ref<number | null>(null)

const gradientId = `activity-gradient-${useId()}`

const coords = computed(() => {
  const max = Math.max(1, ...props.points)
  const n = props.points.length
  const stepX = n > 1 ? width / (n - 1) : 0
  return props.points.map((v, i) => {
    const x = n > 1 ? i * stepX : width / 2
    const y = props.height - padY - ((v / max) * (props.height - padY * 2))
    return { x, y }
  })
})

function buildLine(c: { x: number; y: number }[]): string {
  if (!c.length) return ''
  if (c.length === 1) return `M ${c[0].x} ${c[0].y}`
  let d = `M ${c[0].x} ${c[0].y}`
  for (let i = 1; i < c.length; i++) {
    const prev = c[i - 1]
    const curr = c[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

const linePath = computed(() => buildLine(coords.value))

const areaPath = computed(() => {
  const c = coords.value
  if (!c.length) return ''
  const line = buildLine(c)
  return `${line} L ${c[c.length - 1].x} ${props.height} L ${c[0].x} ${props.height} Z`
})

function onMouseMove(e: MouseEvent) {
  const svg = svgRef.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  const n = props.points.length
  if (n <= 0) return
  const idx = Math.round(ratio * (n - 1))
  hoverIndex.value = Math.max(0, Math.min(n - 1, idx))
}

const tooltipStyle = computed(() => {
  if (hoverIndex.value === null) return {}
  const c = coords.value[hoverIndex.value]
  const leftPct = (c.x / width) * 100
  const isRight = leftPct > 70
  const isLeft = leftPct < 30
  return {
    left: isRight ? 'auto' : `${leftPct}%`,
    right: isRight ? `${100 - leftPct}%` : 'auto',
    top: '0px',
    transform: isLeft ? 'translateX(0)' : isRight ? 'translateX(0)' : 'translateX(-50%)',
  }
})
</script>
