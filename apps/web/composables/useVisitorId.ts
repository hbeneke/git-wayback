const VISITOR_ID_KEY = 'git-wayback-visitor-id'

export function useVisitorId(): string {
  if (import.meta.server) return ''

  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}
