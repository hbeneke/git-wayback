import { getRepoOverview } from '../../../../services/repo'

// Cached here rather than through a routeRules entry: the rule key needs a
// wildcard to leave /evolution uncached, and a wildcard key makes Nitro
// register the page renderer over this route. swr still emits s-maxage, so the
// CDN keeps caching it. Uncached, every page view cost 6 GitHub calls and
// capped the site at ~830 views/hour against an authenticated token.
export default defineCachedEventHandler(
  async (event) => {
    const { owner, repo } = validateRepoParams(event)

    // A forced refresh must not be parked in the CDN, or the next click would
    // be answered with the copy it was trying to replace.
    if (isForcedRefresh(event)) setHeader(event, 'Cache-Control', 'no-store')

    return getRepoOverview(owner, repo)
  },
  {
    maxAge: 600,
    swr: true,
    group: 'nitro/routes',
    name: 'repo-overview',
    // Keyed on the repo alone. The default key folds in the query string, so
    // "?refresh=1" would otherwise write a second entry and leave the one every
    // other visitor reads untouched.
    getKey: (event) => {
      const { owner, repo } = validateRepoParams(event)
      return `${owner}:${repo}`.toLowerCase()
    },
    // Invalidate rather than bypass: the refreshed value replaces the shared
    // entry, so one click updates the repo for everyone. Rate limiting for this
    // happens in the middleware, before the handler runs.
    shouldInvalidateCache: (event) => isForcedRefresh(event),
  },
)
