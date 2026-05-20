/**
 * Security headers middleware.
 * Applies standard security headers to all responses.
 */

// Allow what the app actually needs:
// - Vue/Nuxt hydration ships inline scripts → script-src needs 'unsafe-inline'.
//   (Could be tightened with nonces; deferred.)
// - GitHub avatars served from avatars.githubusercontent.com.
// - D3 + Tailwind inline styles → style-src 'unsafe-inline'.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://avatars.githubusercontent.com https://github.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

export default defineEventHandler((event) => {
  setHeaders(event, {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  })
})
