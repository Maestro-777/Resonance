import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type LibraryTrack = {
  id: string
  title: string
  artist: string
  album: string
  albumArtist: string
  track: number | null
  year: number | null
  genre: string | null
  duration: number
  format: string
  replayGainDb: number | null
  size: number
  relativePath: string
  hasEmbeddedPicture: boolean
}

type LibraryResponse = { tracks: LibraryTrack[]; lastScan: string | null }
type RepeatMode = 'off' | 'all' | 'one'

type PlayerContextValue = {
  tracks: LibraryTrack[]
  currentTrack: LibraryTrack | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  queue: LibraryTrack[]
  favorites: string[]
  loading: boolean
  error: string | null
  connected: boolean
  accessKey: string
  setAccessKey: (key: string) => Promise<void>
  refreshLibrary: () => Promise<void>
  scanLibrary: () => Promise<void>
  playTrack: (track: LibraryTrack) => Promise<void>
  togglePlay: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleFavorite: (id: string) => void
  addToQueue: (track: LibraryTrack) => void
  clearQueue: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
const FAVORITES_KEY = 'resonance.favorites.v1'
const QUEUE_KEY = 'resonance.queue.v1'
const ACCESS_KEY = 'resonance.accessKey'

function readIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function request<T>(path: string, init: RequestInit = {}, key = ''): Promise<T> {
  const headers = new Headers(init.headers)
  if (key) headers.set('x-resonance-key', key)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Ошибка сервера (HTTP ${response.status})`)
  return payload as T
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [tracks, setTracks] = useState<LibraryTrack[]>([])
  const [currentTrack, setCurrentTrack] = useState<LibraryTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.72)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY))
  const [queueIds, setQueueIds] = useState<string[]>(() => readIds(QUEUE_KEY))
  const [accessKey, setAccessKeyState] = useState(() => localStorage.getItem(ACCESS_KEY) || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const refreshLibrary = useCallback(async () => {
    if (!accessKey) {
      setConnected(false)
      return
    }
    setLoading(true)
    try {
      const result = await request<LibraryResponse>('/api/library', {}, accessKey)
      setTracks(result.tracks || [])
      setConnected(true)
      setError(null)
    } catch (cause) {
      setConnected(false)
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить библиотеку')
      throw cause
    } finally {
      setLoading(false)
    }
  }, [accessKey])

  const setAccessKey = useCallback(async (key: string) => {
    const clean = key.trim()
    if (!clean) throw new Error('Введите ключ доступа.')
    await request<{ ok: boolean }>('/api/auth/session', {
      method: 'POST',
      headers: { 'x-resonance-key': clean },
    })
    localStorage.setItem(ACCESS_KEY, clean)
    setAccessKeyState(clean)
    setError(null)
    const result = await request<LibraryResponse>('/api/library', {}, clean)
    setTracks(result.tracks || [])
    setConnected(true)
  }, [])

  const scanLibrary = useCallback(async () => {
    if (!accessKey) throw new Error('Сначала подключите музыкальный сервер.')
    setLoading(true)
    try {
      await request('/api/library/scan', { method: 'POST' }, accessKey)
      const result = await request<LibraryResponse>('/api/library', {}, accessKey)
      setTracks(result.tracks || [])
      setConnected(true)
      setError(null)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Не удалось просканировать папку'
      setError(message)
      throw cause
    } finally {
      setLoading(false)
    }
  }, [accessKey])

  useEffect(() => {
    if (accessKey) void refreshLibrary().catch(() => {})
  }, [accessKey, refreshLibrary])

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueIds))
  }, [queueIds])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const playTrack = useCallback(async (track: LibraryTrack) => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTrack(track)
    setCurrentTime(0)
    setDuration(track.duration || 0)
    audio.src = `/api/stream/${encodeURIComponent(track.id)}`
    audio.load()
    try {
      await audio.play()
      setIsPlaying(true)
      setError(null)
    } catch (cause) {
      setIsPlaying(false)
      setError(cause instanceof Error ? cause.message : 'Браузер не смог начать воспроизведение')
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!currentTrack) {
      if (tracks[0]) await playTrack(tracks[0])
      return
    }
    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось продолжить воспроизведение')
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [currentTrack, playTrack, tracks])

  const next = useCallback(async () => {
    if (!tracks.length) return
    const currentIndex = currentTrack ? tracks.findIndex(track => track.id === currentTrack.id) : -1
    let nextTrack: LibraryTrack | undefined
    if (shuffle && tracks.length > 1) {
      const candidates = tracks.filter(track => track.id !== currentTrack?.id)
      nextTrack = candidates[Math.floor(Math.random() * candidates.length)]
    } else if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
      nextTrack = tracks[currentIndex + 1]
    } else if (repeat === 'all' || currentIndex === -1) {
      nextTrack = tracks[0]
    }
    if (nextTrack) await playTrack(nextTrack)
    else {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [currentTrack, playTrack, repeat, shuffle, tracks])

  const previous = useCallback(async () => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }
    if (!tracks.length) return
    const index = currentTrack ? tracks.findIndex(track => track.id === currentTrack.id) : 0
    const previousTrack = tracks[Math.max(0, index - 1)]
    if (previousTrack) await playTrack(previousTrack)
  }, [currentTrack, playTrack, tracks])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(seconds)) return
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds))
    setCurrentTime(audio.currentTime)
  }, [])

  const setVolume = useCallback((value: number) => {
    const nextValue = Math.max(0, Math.min(1, value))
    setVolumeState(nextValue)
    if (audioRef.current) audioRef.current.volume = nextValue
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }, [])

  const addToQueue = useCallback((track: LibraryTrack) => {
    setQueueIds(current => current.includes(track.id) ? current : [...current, track.id])
  }, [])

  const clearQueue = useCallback(() => setQueueIds([]), [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime || 0)
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0
        void audio.play()
      } else {
        void next()
      }
    }
    const onError = () => {
      if (audio.error) setError('Не удалось воспроизвести файл. Проверьте формат и подключение к серверу.')
      setIsPlaying(false)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [next, repeat])

  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [{ src: `/api/cover/${encodeURIComponent(currentTrack.id)}`, sizes: '512x512', type: 'image/jpeg' }],
    })
    navigator.mediaSession.setActionHandler('play', () => void togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => void togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => void previous())
    navigator.mediaSession.setActionHandler('nexttrack', () => void next())
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (typeof details.seekTime === 'number') seek(details.seekTime)
    })
  }, [currentTrack, next, previous, seek, togglePlay])

  const queue = useMemo(() => queueIds.map(id => tracks.find(track => track.id === id)).filter((item): item is LibraryTrack => Boolean(item)), [queueIds, tracks])
  const value = useMemo<PlayerContextValue>(() => ({
    tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites,
    loading, error, connected, accessKey, setAccessKey, refreshLibrary, scanLibrary, playTrack, togglePlay,
    next, previous, seek, setVolume, toggleShuffle: () => setShuffle(value => !value),
    cycleRepeat: () => setRepeat(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'),
    toggleFavorite, addToQueue, clearQueue,
  }), [tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites, loading, error, connected, accessKey, setAccessKey, refreshLibrary, scanLibrary, playTrack, togglePlay, next, previous, seek, setVolume, toggleFavorite, addToQueue, clearQueue])

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
