<template>
  <header class="sticky top-0 z-50 bg-[rgb(var(--bg))]/95 backdrop-blur-sm border-b border-[rgb(var(--border)/.3)]">
    <div class="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-6">
      <NuxtLink to="/" class="shrink-0 flex items-start gap-3">
        <AppLogo class="mt-1" />
        <div class="flex flex-col">
          <div class="font-mono mt-2">
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
