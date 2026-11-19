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
export type UserPlaylist = { id: string; name: string; trackIds: string[] }
type SyncState = { favorites?: string[]; history?: string[]; queue?: string[]; playlists?: UserPlaylist[] }

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
  history: string[]
  playlists: UserPlaylist[]
  createPlaylist: (name: string) => void
  addTrackToPlaylist: (playlistId: string, trackId: string) => void
  loading: boolean
  error: string | null
  connected: boolean
  accessKey: string
  setAccessKey: (key: string) => Promise<void>
  refreshLibrary: () => Promise<void>
  scanLibrary: () => Promise<void>
  playTrack: (track: LibraryTrack) => Promise<void>
  playOfflineTrack: (track: LibraryTrack, blob: Blob) => Promise<void>
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
const HISTORY_KEY = 'resonance.history.v1'
const PLAYLISTS_KEY = 'resonance.playlists.v1'
const ACCESS_KEY = 'resonance.accessKey'

function readPlaylists(): UserPlaylist[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is UserPlaylist => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.trackIds)))
  } catch { return [] }
}

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
  const objectUrlRef = useRef<string | null>(null)
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
  const [history, setHistory] = useState<string[]>(() => readIds(HISTORY_KEY))
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => readPlaylists())
  const [syncLoaded, setSyncLoaded] = useState(false)
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
  }, [playlists])

  useEffect(() => {
    if (!connected || !accessKey) {
      setSyncLoaded(false)
      return
    }
    let active = true
    setSyncLoaded(false)
    request<SyncState>('/api/sync', {}, accessKey).then(remote => {
      if (!active) return
      if (remote.favorites) setFavorites(current => [...new Set([...current, ...remote.favorites!])])
      if (remote.history) setHistory(current => [...new Set([...current, ...remote.history!])].slice(0, 500))
      if (remote.queue) setQueueIds(current => [...new Set([...current, ...remote.queue!])].slice(0, 5000))
      if (remote.playlists) setPlaylists(current => {
        const merged = new Map(current.map(item => [item.id, item]))
        for (const item of remote.playlists || []) {
          const previous = merged.get(item.id)
          merged.set(item.id, previous ? { ...previous, ...item, trackIds: [...new Set([...previous.trackIds, ...item.trackIds])] } : item)
        }
        return [...merged.values()]
      })
    }).catch(() => {
      if (active) setError('Не удалось загрузить синхронизацию. Локальные данные сохранены.')
    }).finally(() => {
      if (active) setSyncLoaded(true)
    })
    return () => { active = false }
  }, [connected, accessKey])

  useEffect(() => {
    if (!connected || !accessKey || !syncLoaded) return
    const timer = window.setTimeout(() => {
      void request('/api/sync', {
        method: 'PUT',
        body: JSON.stringify({ version: 1, favorites, history, queue: queueIds, playlists }),
      }, accessKey).catch(() => setError('Синхронизация временно недоступна. Изменения сохранены на этом устройстве.'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [connected, accessKey, syncLoaded, favorites, history, queueIds, playlists])

  const createPlaylist = useCallback((name: string) => {
    const clean = name.trim().slice(0, 120)
    if (!clean) return
    setPlaylists(items => [...items, { id: crypto.randomUUID(), name: clean, trackIds: [] }])
  }, [])

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(items => items.map(item => item.id === playlistId ? { ...item, trackIds: [...new Set([...item.trackIds, trackId])] } : item))
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const playTrack = useCallback(async (track: LibraryTrack) => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTrack(track)
    setHistory(items => [track.id, ...items.filter(id => id !== track.id)].slice(0, 500))
    setCurrentTime(0)
    setDuration(track.duration || 0)
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
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

  const playOfflineTrack = useCallback(async (track: LibraryTrack, blob: Blob) => {
    const audio = audioRef.current
    if (!audio) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url
    setCurrentTrack(track)
    setHistory(items => [track.id, ...items.filter(id => id !== track.id)].slice(0, 500))
    setCurrentTime(0)
    setDuration(track.duration || 0)
    audio.src = url
    audio.load()
    try {
      await audio.play()
      setIsPlaying(true)
      setError(null)
    } catch (cause) {
      setIsPlaying(false)
      setError(cause instanceof Error ? cause.message : 'Не удалось воспроизвести офлайн-файл')
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
    if (queueIds.length) {
      const queuedId = queueIds[0]
      const queuedTrack = tracks.find(track => track.id === queuedId)
      setQueueIds(items => items.slice(1))
      if (queuedTrack) {
        await playTrack(queuedTrack)
        return
      }
    }
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
  }, [currentTrack, playTrack, queueIds, repeat, shuffle, tracks])

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
    tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites, history, playlists, createPlaylist, addTrackToPlaylist,
    loading, error, connected, accessKey, setAccessKey, refreshLibrary, scanLibrary, playTrack, togglePlay,
    next, previous, seek, setVolume, playOfflineTrack, toggleShuffle: () => setShuffle(value => !value),
    cycleRepeat: () => setRepeat(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'),
    toggleFavorite, addToQueue, clearQueue,
  }), [tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites, history, playlists, createPlaylist, addTrackToPlaylist, loading, error, connected, accessKey, setAccessKey, refreshLibrary, scanLibrary, playTrack, playOfflineTrack, togglePlay, next, previous, seek, setVolume, toggleFavorite, addToQueue, clearQueue])

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
