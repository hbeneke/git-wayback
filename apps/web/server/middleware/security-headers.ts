/**
 * Security headers middleware.
 * Applies standard security headers to all responses.
 */
export default defineEventHandler((event) => {
  setHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  })
})
