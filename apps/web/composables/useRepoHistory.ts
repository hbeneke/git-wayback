export interface HistoryEntry {
  fullName: string
  avatar: string
  visitedAt: string
}

const HISTORY_KEY = 'git-wayback-history'
const MAX_HISTORY = 10

export function useRepoHistory() {
  const history = ref<HistoryEntry[]>([])

  /** localStorage is user-writable, so nothing read back from it is trusted. */
  function isEntry(value: unknown): value is HistoryEntry {
    const entry = value as HistoryEntry
    return (
      typeof entry?.fullName === 'string' &&
      typeof entry?.avatar === 'string' &&
      typeof entry?.visitedAt === 'string'
    )
  }

  function load() {
    if (import.meta.server) return
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      history.value = Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_HISTORY) : []
    } catch {
      history.value = []
    }
  }

  function save() {
    // Throws on a full quota and in some private browsing modes. History is a
    // convenience, so a failed write must not take the page down with it.
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
    } catch {
      // Ignored on purpose.
    }
  }

  function addEntry(entry: Omit<HistoryEntry, 'visitedAt'>) {
    const filtered = history.value.filter((h) => h.fullName !== entry.fullName)
    filtered.unshift({
      ...entry,
      visitedAt: new Date().toISOString(),
    })
    history.value = filtered.slice(0, MAX_HISTORY)
    save()
  }

  function removeEntry(fullName: string) {
    history.value = history.value.filter((h) => h.fullName !== fullName)
    save()
  }

  onMounted(load)

  return {
    history,
    addEntry,
    removeEntry,
  }
}
