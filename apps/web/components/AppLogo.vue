<template>
  <div class="logo-container w-16 h-16 flex items-center justify-center rounded-lg transition-all duration-300 hover:ring-1 hover:ring-[rgb(var(--secondary)/.3)]">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" class="w-full h-full rounded-lg">
      <rect width="64" height="64" rx="8" fill="#f7df1e"/>
      <g class="hourglass">
        <line x1="16" y1="8" x2="48" y2="8" stroke="#000" stroke-width="3" stroke-linecap="round"/>
        <line x1="16" y1="56" x2="48" y2="56" stroke="#000" stroke-width="3" stroke-linecap="round"/>
        <path d="M19 11 L19 24 L32 32 L19 40 L19 53" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M45 11 L45 24 L32 32 L45 40 L45 53" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
      <polygon class="sand" points="22,22 42,22 32,30" fill="#000" opacity="0.3"/>
      <rect class="sand" x="22" y="48" width="20" height="5" fill="#000" opacity="0.3"/>
    </svg>
  </div>
</template>

<style scoped>
.hourglass {
  transform-origin: 32px 32px;
}

.logo-container:hover .hourglass {
  animation: flip 1.6s ease-in-out infinite;
}

.logo-container:hover .sand {
  animation: sand-blink 1.6s ease-in-out infinite;
}

@keyframes flip {
  0% { transform: rotate(0deg); }
  37.5% { transform: rotate(180deg); }
  100% { transform: rotate(180deg); }
}

@keyframes sand-blink {
  0% { opacity: 0.3; }
  15% { opacity: 0; }
  22% { opacity: 0; }
  37.5% { opacity: 0.3; }
  100% { opacity: 0.3; }
}
</style>
