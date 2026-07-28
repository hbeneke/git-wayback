export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@vercel/analytics/nuxt',
    '@vercel/speed-insights/nuxt',
  ],

  // Treat parley web components as custom elements, not Vue components
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'site-footer',
    },
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  // SEO & Meta
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'git-wayback - Visualize GitHub Repository Evolution',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        { name: 'author', content: 'git-wayback' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'git-wayback' },
        {
          property: 'og:title',
          content: 'git-wayback - Visualize GitHub Repository Evolution',
        },
        {
          property: 'og:description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'twitter:title',
          content: 'git-wayback - Visualize GitHub Repository Evolution',
        },
        {
          name: 'twitter:description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        // SEO
        {
          name: 'keywords',
          content:
            'github, repository, visualization, git history, commits, open source, developer tools',
        },
        { name: 'robots', content: 'index, follow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'canonical', href: 'https://git-wayback.dev' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  // Ensure SPA-like navigation
  router: {
    options: {
      scrollBehaviorType: 'smooth',
    },
  },

  // SSR for SEO, but hydrate for SPA behavior
  ssr: true,

  // The home page shows live rankings, so it cannot be prerendered: the
  // payload would be baked at build time and never refresh. Stale-while-
  // revalidate keeps the static-like response without freezing the data.
  routeRules: {
    '/': { swr: 300 },
    '/rankings/**': { swr: 300 },

    // Two segments only, so /api/repos/:owner/:repo is cached but its
    // /evolution subroute is not — that one has its own snapshot cache.
    // Uncached, every page view cost 6 GitHub calls and capped the whole site
    // at ~830 views/hour against an authenticated token.
    '/api/repos/*/*': { swr: 600 },
    '/api/search': { swr: 60 },
    '/api/rankings': { swr: 300 },
    '/api/rankings/**': { swr: 300 },
  },

  // Nitro optimizations
  nitro: {
    prerender: {
      // Crawling from the home page followed the ranking links and prerendered
      // arbitrary /{owner}/{repo} routes — build-time GitHub calls for pages
      // that are then served stale.
      crawlLinks: false,
    },
    compressPublicAssets: true,
  },
})
