import { getRepoOverview } from '../../../../services/repo'

// Cached here rather than through a routeRules entry: the rule key needs a
// wildcard to leave /evolution uncached, and a wildcard key makes Nitro
// register the page renderer over this route. swr still emits s-maxage, so the
// CDN keeps caching it. Uncached, every page view cost 6 GitHub calls and
// capped the site at ~830 views/hour against an authenticated token.
export default defineCachedEventHandler(
  async (event) => {
    const { owner, repo } = validateRepoParams(event)

    return getRepoOverview(owner, repo)
  },
  {
    maxAge: 600,
    swr: true,
    group: 'nitro/routes',
    name: 'repo-overview',
  },
)
