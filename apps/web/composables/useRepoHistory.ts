export interface HistoryEntry {
  fullName: string
  avatar: string
  visitedAt: string
}

const HISTORY_KEY = 'git-wayback-history'
const MAX_HISTORY = 10

export function useRepoHistory() {
  const history = ref<HistoryEntry[]>([])

  function load() {
    if (import.meta.server) return
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) history.value = JSON.parse(raw)
    } catch {
      history.value = []
    }
  }

  function save() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
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
