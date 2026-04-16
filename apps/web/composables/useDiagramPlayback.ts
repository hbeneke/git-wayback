import { TIMELINE_PLAYBACK_INTERVAL_MS } from '@git-wayback/shared'

export function useDiagramPlayback(
  currentIndex: Ref<number>,
  totalSnapshots: ComputedRef<number>,
) {
  const isPlaying = ref(false)
  let playInterval: ReturnType<typeof setInterval> | null = null

  function startPlay() {
    isPlaying.value = true
    if (currentIndex.value >= totalSnapshots.value - 1) {
      currentIndex.value = 0
    }
    playInterval = setInterval(() => {
      if (currentIndex.value < totalSnapshots.value - 1) {
        currentIndex.value++
      } else {
        stopPlay()
      }
    }, TIMELINE_PLAYBACK_INTERVAL_MS)
  }

  function stopPlay() {
    isPlaying.value = false
    if (playInterval) {
      clearInterval(playInterval)
      playInterval = null
    }
  }

  function togglePlay() {
    if (isPlaying.value) {
      stopPlay()
    } else {
      startPlay()
    }
  }

  return {
    isPlaying,
    togglePlay,
    stopPlay,
  }
}
