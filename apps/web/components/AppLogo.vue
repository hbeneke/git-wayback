<template>
  <div
    class="logo-container flex items-center justify-center transition-all duration-300 hover:ring-1 hover:ring-[rgb(var(--secondary)/.3)]"
    :class="[size, rounded]"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" class="w-full h-full" :class="rounded">
      <rect width="64" height="64" rx="8" fill="#f7df1e"/>
      <g class="flower">
        <!-- 14 spokes of uneven length, so the outer nodes do not land on one
             circle. -->
        <g fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round">
          <path d="M32 32 L50.1 35.8"/>
          <path d="M32 32 L42.3 40"/>
          <path d="M32 32 L39.2 46.3"/>
          <path d="M32 32 L32.3 51"/>
          <path d="M32 32 L26.7 43.3"/>
          <path d="M32 32 L18.9 42.8"/>
          <path d="M32 32 L17.9 35.4"/>
          <path d="M32 32 L14.4 28.3"/>
          <path d="M32 32 L21.3 23.7"/>
          <path d="M32 32 L24.6 17.2"/>
          <path d="M32 32 L31.7 12.5"/>
          <path d="M32 32 L37 21.1"/>
          <path d="M32 32 L45.5 20.9"/>
          <path d="M32 32 L46.6 28.4"/>
        </g>
        <!-- Second level: seven of the nodes fan out again, each rib a
             different length. Thinner stroke keeps it from turning to mud at
             w-5. -->
        <g fill="none" stroke="#000" stroke-width="0.8" stroke-linecap="round">
          <path d="M50.1 35.8 L56.6 32"/>
          <path d="M50.1 35.8 L55.5 36.9"/>
          <path d="M50.1 35.8 L53.9 41.1"/>
          <path d="M39.2 46.3 L44.8 48.5"/>
          <path d="M39.2 46.3 L42.3 52.6"/>
          <path d="M39.2 46.3 L37.9 51.1"/>
          <path d="M32.3 51 L35.7 54.7"/>
          <path d="M32.3 51 L32.4 57.5"/>
          <path d="M32.3 51 L27.4 56.6"/>
          <path d="M18.9 42.8 L17.9 49.7"/>
          <path d="M18.9 42.8 L15 46"/>
          <path d="M18.9 42.8 L12.9 42.5"/>
          <path d="M14.4 28.3 L8.8 31.6"/>
          <path d="M14.4 28.3 L7.1 26.7"/>
          <path d="M14.4 28.3 L11.2 23.9"/>
          <path d="M31.7 12.5 L28 8.5"/>
          <path d="M31.7 12.5 L31.6 6.5"/>
          <path d="M31.7 12.5 L36.3 7.2"/>
          <path d="M45.5 20.9 L46.5 14"/>
          <path d="M45.5 20.9 L50.1 17.1"/>
          <path d="M45.5 20.9 L50.5 21.1"/>
        </g>
        <!-- Radius tracks degree: a node that branches again is drawn bigger
             than one that ends there. -->
        <g fill="#000">
          <circle cx="50.1" cy="35.8" r="3.5"/>
          <circle cx="39.2" cy="46.3" r="3.2"/>
          <circle cx="32.3" cy="51" r="3.4"/>
          <circle cx="18.9" cy="42.8" r="3.3"/>
          <circle cx="14.4" cy="28.3" r="3.5"/>
          <circle cx="31.7" cy="12.5" r="3.2"/>
          <circle cx="45.5" cy="20.9" r="3.4"/>
        </g>
        <g fill="#000">
          <circle cx="42.3" cy="40" r="2.4"/>
          <circle cx="26.7" cy="43.3" r="1.7"/>
          <circle cx="17.9" cy="35.4" r="2.1"/>
          <circle cx="21.3" cy="23.7" r="1.5"/>
          <circle cx="24.6" cy="17.2" r="2.6"/>
          <circle cx="37" cy="21.1" r="1.8"/>
          <circle cx="46.6" cy="28.4" r="2.2"/>
        </g>
        <g fill="#000">
          <circle cx="56.6" cy="32" r="1.9"/>
          <circle cx="55.5" cy="36.9" r="0.9"/>
          <circle cx="53.9" cy="41.1" r="1.4"/>
          <circle cx="44.8" cy="48.5" r="1.1"/>
          <circle cx="42.3" cy="52.6" r="1.8"/>
          <circle cx="37.9" cy="51.1" r="0.8"/>
          <circle cx="35.7" cy="54.7" r="1.6"/>
          <circle cx="32.4" cy="57.5" r="1.2"/>
          <circle cx="27.4" cy="56.6" r="2.0"/>
          <circle cx="17.9" cy="49.7" r="1.0"/>
          <circle cx="15" cy="46" r="1.5"/>
          <circle cx="12.9" cy="42.5" r="0.9"/>
          <circle cx="8.8" cy="31.6" r="1.7"/>
          <circle cx="7.1" cy="26.7" r="1.3"/>
          <circle cx="11.2" cy="23.9" r="1.1"/>
          <circle cx="28" cy="8.5" r="0.8"/>
          <circle cx="31.6" cy="6.5" r="1.9"/>
          <circle cx="36.3" cy="7.2" r="1.2"/>
          <circle cx="46.5" cy="14" r="1.4"/>
          <circle cx="50.1" cy="17.1" r="1.0"/>
          <circle cx="50.5" cy="21.1" r="1.6"/>
        </g>
      </g>
      <!-- Root node: clearly the largest, every spoke starts here. -->
      <circle cx="32" cy="32" r="5.6" fill="#000"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
/**
 * Tailwind sizing/rounding classes for the mark — the header shrinks it on
 * scroll, where it matches the portfolio listing on personal-site (w-5 h-5,
 * `rounded`).
 */
withDefaults(
  defineProps<{ size?: string; rounded?: string }>(),
  { size: 'w-16 h-16', rounded: 'rounded-lg' }
)
</script>

<style scoped>
.flower {
  transform-origin: 32px 32px;
}

.logo-container:hover .flower {
  animation: bloom 8s linear infinite;
}

@keyframes bloom {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .logo-container:hover .flower {
    animation: none;
  }
}
</style>
