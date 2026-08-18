<template>
  <header
    class="sticky top-0 z-50 bg-[rgb(var(--bg))]/95 backdrop-blur-sm border-b border-[rgb(var(--border)/.3)] transition-[padding] duration-200"
  >
    <!-- max-w-6xl matches the repo page, the widest content column. -->
    <div
      class="max-w-6xl mx-auto px-4 sm:px-8 flex gap-6 transition-all duration-200"
      :class="collapsed ? 'py-1.5 items-center' : 'py-3 items-start'"
    >
      <NuxtLink
        to="/"
        class="shrink-0 flex gap-3 transition-all duration-200"
        :class="collapsed ? 'items-center' : 'items-start'"
      >
        <!-- Collapsed, the mark matches the portfolio listing on personal-site:
             w-5 h-5 with `rounded`, not the large tile's rounded-lg. -->
        <AppLogo
          :size="collapsed ? 'w-5 h-5' : 'w-16 h-16'"
          :rounded="collapsed ? 'rounded' : 'rounded-lg'"
          :class="collapsed ? '' : 'mt-1'"
        />
        <div class="flex flex-col">
          <div class="font-mono transition-all duration-200" :class="collapsed ? 'mt-0' : 'mt-2'">
            <span class="text-sm font-semibold text-secondary">
              git-wayback<span class="animate-blink">_</span>
            </span>
          </div>
        </div>
      </NuxtLink>

      <AppSearch />
    </div>
  </header>
</template>

<script setup lang="ts">
// Collapse past this many pixels. The gap between it and 0 stops the header
// flickering between states when a scroll lands right on the boundary.
const COLLAPSE_AT = 32
const EXPAND_AT = 8

const scrolled = ref(false)
// The expanded diagram pins it collapsed — scrolling is locked while it is open.
const forced = useHeaderCollapsed()
const collapsed = computed(() => forced.value || scrolled.value)

let frame: number | null = null

function readScroll() {
  frame = null
  const y = window.scrollY
  if (!scrolled.value && y > COLLAPSE_AT) scrolled.value = true
  else if (scrolled.value && y < EXPAND_AT) scrolled.value = false
}

// Scroll fires far more often than paint; coalesce into one rAF.
function onScroll() {
  if (frame !== null) return
  frame = requestAnimationFrame(readScroll)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  readScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (frame !== null) cancelAnimationFrame(frame)
})
</script>
