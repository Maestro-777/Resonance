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
type SyncState = { favorites?: string[]; history?: string[]; queue?: string[]; playlists?: UserPlaylist[]; equalizer?: { eq?: Record<string, number>; eqPreset?: string }; preferences?: { crossfadeSeconds?: number } }

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
  equalizer: Record<string, number>
  equalizerPreset: string
  setEqBand: (frequency: string, gain: number) => void
  setEqPreset: (preset: string) => void
  playlists: UserPlaylist[]
  createPlaylist: (name: string) => string | null
  addTrackToPlaylist: (playlistId: string, trackId: string) => void
  loading: boolean
  error: string | null
  connected: boolean
  accessKey: string
  setAccessKey: (key: string) => Promise<void>
  disconnect: () => void
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
  sleepTimer: number | null
  setSleepTimer: (minutes: number | null) => void
  crossfadeSeconds: number
  setCrossfadeSeconds: (seconds: number) => void
  exportData: () => string
  importData: (content: string) => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
const FAVORITES_KEY = 'resonance.favorites.v1'
const QUEUE_KEY = 'resonance.queue.v1'
const HISTORY_KEY = 'resonance.history.v1'
const PLAYLISTS_KEY = 'resonance.playlists.v1'
const EQ_KEY = 'resonance.equalizer.v1'
const PLAYBACK_KEY = 'resonance.playback.v1'
const CROSSFADE_KEY = 'resonance.crossfade.v1'
const EQ_BANDS = ['32', '64', '125', '250', '500', '1000', '2000', '4000', '8000', '16000']
const ACCESS_KEY = 'resonance.accessKey'

function readEqualizer(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(EQ_KEY) || '{}') as Record<string, unknown>
    return Object.fromEntries(EQ_BANDS.map(key => [key, typeof value[key] === 'number' ? Math.max(-12, Math.min(12, value[key] as number)) : 0]))
  } catch { return Object.fromEntries(EQ_BANDS.map(key => [key, 0])) }
}

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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const secondarySourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const deckGainRef = useRef<GainNode | null>(null)
  const secondaryDeckGainRef = useRef<GainNode | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const crossfadeActiveRef = useRef(false)
  const preloadedTrackIdRef = useRef('')
  const filterNodesRef = useRef<BiquadFilterNode[]>([])
  const objectUrlRef = useRef<string | null>(null)
  const restoredPlaybackRef = useRef(false)
  const [tracks, setTracks] = useState<LibraryTrack[]>([])
  const [currentTrack, setCurrentTrack] = useState<LibraryTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.72)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null)
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState(() => Math.max(0, Math.min(8, Number(localStorage.getItem(CROSSFADE_KEY) ?? 4) || 0)) )
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY))
  const [queueIds, setQueueIds] = useState<string[]>(() => readIds(QUEUE_KEY))
  const [history, setHistory] = useState<string[]>(() => readIds(HISTORY_KEY))
  const [equalizer, setEqualizer] = useState<Record<string, number>>(() => readEqualizer())
  const [equalizerPreset, setEqualizerPreset] = useState('Пользовательский')
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

  const disconnect = useCallback(() => {
    audioRef.current?.pause()
    secondaryAudioRef.current?.pause()
    localStorage.removeItem(ACCESS_KEY)
    setAccessKeyState('')
    setConnected(false)
    setTracks([])
    setCurrentTrack(null)
    setIsPlaying(false)
    setError(null)
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
    localStorage.setItem(EQ_KEY, JSON.stringify(equalizer))
  }, [equalizer])

  useEffect(() => {
    localStorage.setItem(CROSSFADE_KEY, String(crossfadeSeconds))
  }, [crossfadeSeconds])

  useEffect(() => {
    if (currentTrack) localStorage.setItem(PLAYBACK_KEY, JSON.stringify({ trackId: currentTrack.id, position: currentTime }))
  }, [currentTrack, currentTime])

  useEffect(() => {
    if (!tracks.length || restoredPlaybackRef.current) return
    restoredPlaybackRef.current = true
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYBACK_KEY) || 'null') as { trackId?: string; position?: number } | null
      const track = saved?.trackId ? tracks.find(item => item.id === saved.trackId) : undefined
      if (!track) return
      const position = Number.isFinite(saved?.position) ? Math.max(0, saved!.position!) : 0
      setCurrentTrack(track)
      setCurrentTime(position)
      setDuration(track.duration || 0)
      const audio = audioRef.current
      if (audio) {
        audio.src = `/api/stream/${encodeURIComponent(track.id)}`
        audio.addEventListener('loadedmetadata', () => {
          audio.currentTime = Math.min(position, audio.duration || position)
          setCurrentTime(audio.currentTime)
        }, { once: true })
        audio.load()
      }
    } catch { /* ignore a malformed local playback snapshot */ }
  }, [tracks])

  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerState(minutes && minutes > 0 ? Date.now() + minutes * 60_000 : null)
  }, [])

  const setCrossfadeSeconds = useCallback((seconds: number) => {
    setCrossfadeSecondsState(Math.max(0, Math.min(8, seconds)))
  }, [])

  useEffect(() => {
    if (!sleepTimer) return
    const timer = window.setTimeout(() => {
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
      crossfadeActiveRef.current = false
      audioRef.current?.pause()
      secondaryAudioRef.current?.pause()
      setIsPlaying(false)
      setSleepTimerState(null)
    }, Math.max(0, sleepTimer - Date.now()))
    return () => window.clearTimeout(timer)
  }, [sleepTimer])



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
      if (remote.equalizer?.eq) setEqualizer(current => ({ ...current, ...remote.equalizer!.eq }))
      if (remote.equalizer?.eqPreset) setEqualizerPreset(remote.equalizer.eqPreset)
      if (typeof remote.preferences?.crossfadeSeconds === 'number') setCrossfadeSecondsState(Math.max(0, Math.min(8, remote.preferences.crossfadeSeconds)))
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
        body: JSON.stringify({ version: 1, favorites, history, queue: queueIds, playlists, equalizer: { eq: equalizer, eqPreset: equalizerPreset }, preferences: { crossfadeSeconds } }),
      }, accessKey).catch(() => setError('Синхронизация временно недоступна. Изменения сохранены на этом устройстве.'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [connected, accessKey, syncLoaded, favorites, history, queueIds, playlists, equalizer, equalizerPreset, crossfadeSeconds])

  const createPlaylist = useCallback((name: string) => {
    const clean = name.trim().slice(0, 120)
    if (!clean) return null
    const id = crypto.randomUUID()
    setPlaylists(items => [...items, { id, name: clean, trackIds: [] }])
    return id
  }, [])

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(items => items.map(item => item.id === playlistId ? { ...item, trackIds: [...new Set([...item.trackIds, trackId])] } : item))
  }, [])

  const exportData = useCallback(() => {
    const snapshot = {
      app: 'resonance',
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites,
      history,
      queue: queueIds,
      playlists,
      equalizer,
      equalizerPreset,
      crossfadeSeconds,
    }
    return JSON.stringify(snapshot, null, 2)
  }, [favorites, history, queueIds, playlists, equalizer, equalizerPreset, crossfadeSeconds])

  const importData = useCallback((content: string) => {
    const data = JSON.parse(content) as Record<string, unknown>
    if (data.app !== 'resonance' || data.version !== 1) throw new Error('Файл не является резервной копией Resonance версии 1.')
    const strings = (value: unknown, limit: number) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length <= 256))].slice(0, limit) : []
    setFavorites(strings(data.favorites, 10000))
    setHistory(strings(data.history, 500))
    setQueueIds(strings(data.queue, 5000))
    if (Array.isArray(data.playlists)) {
      setPlaylists(data.playlists.filter((item): item is UserPlaylist => Boolean(item && typeof item === 'object' && 'id' in item && typeof item.id === 'string' && 'name' in item && typeof item.name === 'string' && 'trackIds' in item && Array.isArray(item.trackIds)).map(item => ({ id: item.id, name: item.name.slice(0, 120), trackIds: strings(item.trackIds, 5000) })))
    }
    if (data.equalizer && typeof data.equalizer === 'object') {
      const source = data.equalizer as Record<string, unknown>
      setEqualizer(Object.fromEntries(EQ_BANDS.map(key => [key, typeof source[key] === 'number' ? Math.max(-12, Math.min(12, source[key] as number)) : 0])))
    }
    if (typeof data.equalizerPreset === 'string') setEqualizerPreset(data.equalizerPreset.slice(0, 40))
    if (typeof data.crossfadeSeconds === 'number') setCrossfadeSecondsState(Math.max(0, Math.min(8, data.crossfadeSeconds)))
  }, [])


  const activateAudioGraph = useCallback(async () => {
    const primary = audioRef.current
    const secondary = secondaryAudioRef.current
    if (!primary || !secondary) return
    if (!audioContextRef.current) {
      const context = new window.AudioContext()
      const source = context.createMediaElementSource(primary)
      const secondarySource = context.createMediaElementSource(secondary)
      const gainA = context.createGain()
      const gainB = context.createGain()
      gainA.gain.value = 1
      gainB.gain.value = 0
      source.connect(gainA)
      secondarySource.connect(gainB)
      const filters = EQ_BANDS.map((frequency, index) => {
        const filter = context.createBiquadFilter()
        filter.type = index === 0 ? 'lowshelf' : index === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
        filter.frequency.value = Number(frequency)
        filter.Q.value = 1
        filter.gain.value = equalizer[frequency] || 0
        return filter
      })
      gainA.connect(filters[0])
      gainB.connect(filters[0])
      filters.forEach((filter, index) => filter.connect(filters[index + 1] || context.destination))
      audioContextRef.current = context
      sourceNodeRef.current = source
      secondarySourceNodeRef.current = secondarySource
      deckGainRef.current = gainA
      secondaryDeckGainRef.current = gainB
      filterNodesRef.current = filters
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume()
  }, [equalizer])

  useEffect(() => {
    filterNodesRef.current.forEach((filter, index) => {
      filter.gain.setTargetAtTime(equalizer[EQ_BANDS[index]] || 0, filter.context.currentTime, 0.015)
    })
  }, [equalizer])

  const setEqBand = useCallback((frequency: string, gain: number) => {
    setEqualizer(current => ({ ...current, [frequency]: Math.max(-12, Math.min(12, gain)) }))
    setEqualizerPreset('Пользовательский')
  }, [])

  const setEqPreset = useCallback((preset: string) => {
    const presets: Record<string, number[]> = {
      'Плоский': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'Басы': [6, 5, 4, 2, 0, -1, -1, 0, 1, 2],
      'Рок': [4, 3, -1, -2, 1, 3, 4, 4, 3, 3],
      'Классика': [3, 2, 1, 1, -1, -1, 0, 2, 3, 4],
      'Джаз': [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
      'Голос': [-3, -2, -1, 1, 3, 4, 3, 2, 0, -1],
    }
    const values = presets[preset]
    if (!values) return
    setEqualizer(Object.fromEntries(EQ_BANDS.map((key, index) => [key, values[index]])))
    setEqualizerPreset(preset)
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      const replayGain = currentTrack?.replayGainDb || 0
      audioRef.current.volume = Math.min(1, volume * Math.pow(10, replayGain / 20))
    }
  }, [volume, currentTrack])

  const playTrack = useCallback(async (track: LibraryTrack) => {
    const audio = audioRef.current
    if (!audio) return
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = null
    crossfadeActiveRef.current = false
    preloadedTrackIdRef.current = ''
    const standby = secondaryAudioRef.current
    standby?.pause()
    if (deckGainRef.current && audioContextRef.current) deckGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime)
    if (secondaryDeckGainRef.current && audioContextRef.current) secondaryDeckGainRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime)
    setCurrentTrack(track)
    setHistory(items => [track.id, ...items.filter(id => id !== track.id)].slice(0, 500))
    await activateAudioGraph()
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
  }, [activateAudioGraph])

  const playOfflineTrack = useCallback(async (track: LibraryTrack, blob: Blob) => {
    const audio = audioRef.current
    if (!audio) return
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = null
    crossfadeActiveRef.current = false
    preloadedTrackIdRef.current = ''
    secondaryAudioRef.current?.pause()
    if (deckGainRef.current && audioContextRef.current) deckGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime)
    if (secondaryDeckGainRef.current && audioContextRef.current) secondaryDeckGainRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime)
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url
    setCurrentTrack(track)
    setHistory(items => [track.id, ...items.filter(id => id !== track.id)].slice(0, 500))
    await activateAudioGraph()
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
  }, [activateAudioGraph])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!currentTrack) {
      if (tracks[0]) await playTrack(tracks[0])
      return
    }
    if (audio.paused) {
      try {
        await activateAudioGraph()
        await audio.play()
        if (crossfadeActiveRef.current) await secondaryAudioRef.current?.play()
        setIsPlaying(true)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось продолжить воспроизведение')
      }
    } else {
      audio.pause()
      if (crossfadeActiveRef.current) secondaryAudioRef.current?.pause()
      setIsPlaying(false)
    }
  }, [activateAudioGraph, currentTrack, playTrack, tracks])

  const transitionTrack = useCallback(() => {
    if (queueIds.length) return tracks.find(track => track.id === queueIds[0]) || null
    if (!currentTrack || repeat === 'one') return null
    if (shuffle && tracks.length > 1) {
      const choices = tracks.filter(track => track.id !== currentTrack.id)
      return choices[Math.floor(Math.random() * choices.length)] || null
    }
    const index = tracks.findIndex(track => track.id === currentTrack.id)
    if (index >= 0 && index < tracks.length - 1) return tracks[index + 1]
    if (repeat === 'all' && tracks.length) return tracks[0]
    return null
  }, [currentTrack, queueIds, repeat, shuffle, tracks])

  const beginCrossfade = useCallback(async (nextTrack: LibraryTrack) => {
    const active = audioRef.current
    const standby = secondaryAudioRef.current
    const context = audioContextRef.current
    const from = deckGainRef.current
    const to = secondaryDeckGainRef.current
    if (!active || !standby || !context || !from || !to || crossfadeActiveRef.current || crossfadeSeconds <= 0) return
    crossfadeActiveRef.current = true
    if (queueIds[0] === nextTrack.id) setQueueIds(items => items.slice(1))
    try {
      standby.pause()
      standby.src = `/api/stream/${encodeURIComponent(nextTrack.id)}`
      standby.volume = Math.min(1, volume * Math.pow(10, (nextTrack.replayGainDb || 0) / 20))
      standby.load()
      if (standby.readyState < 2) await new Promise<void>((resolve, reject) => {
        const done = () => { cleanup(); resolve() }
        const fail = () => { cleanup(); reject(new Error('Не удалось подготовить следующий трек')) }
        const cleanup = () => { standby.removeEventListener('canplay', done); standby.removeEventListener('error', fail) }
        standby.addEventListener('canplay', done, { once: true })
        standby.addEventListener('error', fail, { once: true })
      })
      await standby.play()
      const start = context.currentTime
      from.gain.cancelScheduledValues(start)
      from.gain.setValueAtTime(from.gain.value, start)
      from.gain.linearRampToValueAtTime(0, start + crossfadeSeconds)
      to.gain.cancelScheduledValues(start)
      to.gain.setValueAtTime(0, start)
      to.gain.linearRampToValueAtTime(1, start + crossfadeSeconds)
      transitionTimerRef.current = window.setTimeout(() => {
        const previousDeck = audioRef.current
        if (!previousDeck) return
        audioRef.current = standby
        secondaryAudioRef.current = previousDeck
        deckGainRef.current = to
        secondaryDeckGainRef.current = from
        previousDeck.pause()
        crossfadeActiveRef.current = false
        transitionTimerRef.current = null
        setCurrentTrack(nextTrack)
        setCurrentTime(0)
        setDuration(nextTrack.duration || 0)
        setHistory(items => [nextTrack.id, ...items.filter(id => id !== nextTrack.id)].slice(0, 500))
        setIsPlaying(true)
      }, crossfadeSeconds * 1000)
    } catch {
      crossfadeActiveRef.current = false
      to.gain.cancelScheduledValues(context.currentTime)
      to.gain.setValueAtTime(0, context.currentTime)
      from.gain.setValueAtTime(1, context.currentTime)
      await playTrack(nextTrack)
    }
  }, [crossfadeSeconds, playTrack, queueIds, volume])

  const preloadGaplessNext = useCallback(() => {
    if (crossfadeSeconds !== 0 || crossfadeActiveRef.current) return
    const nextTrack = transitionTrack()
    const standby = secondaryAudioRef.current
    if (!nextTrack || !standby || preloadedTrackIdRef.current === nextTrack.id) return
    standby.pause()
    standby.src = `/api/stream/${encodeURIComponent(nextTrack.id)}`
    standby.load()
    preloadedTrackIdRef.current = nextTrack.id
  }, [crossfadeSeconds, transitionTrack])

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
    if (secondaryAudioRef.current) secondaryAudioRef.current.volume = nextValue
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }, [])

  const addToQueue = useCallback((track: LibraryTrack) => {
    setQueueIds(current => current.includes(track.id) ? current : [...current, track.id])
  }, [])

  const clearQueue = useCallback(() => setQueueIds([]), [])

  useEffect(() => {
    const primary = audioRef.current
    const secondary = secondaryAudioRef.current
    if (!primary || !secondary) return
    const decks = [primary, secondary]
    const onTime = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (audio !== audioRef.current) return
      setCurrentTime(audio.currentTime || 0)
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
      if (audio.duration > 0) {
        const remaining = audio.duration - audio.currentTime
        if (crossfadeSeconds === 0 && remaining <= 12) preloadGaplessNext()
        else if (crossfadeSeconds > 0 && remaining <= crossfadeSeconds + 0.5 && !crossfadeActiveRef.current) {
          const nextTrack = transitionTrack()
          if (nextTrack) void beginCrossfade(nextTrack)
        }
      }
    }
    const onPlay = (event: Event) => { if (event.currentTarget === audioRef.current) setIsPlaying(true) }
    const onPause = (event: Event) => { if (event.currentTarget === audioRef.current) setIsPlaying(false) }
    const onEnded = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (audio !== audioRef.current || crossfadeActiveRef.current) return
      if (repeat === 'one') {
        audio.currentTime = 0
        void audio.play()
        return
      }
      const nextTrack = transitionTrack()
      const standby = secondaryAudioRef.current
      const from = deckGainRef.current
      const to = secondaryDeckGainRef.current
      const context = audioContextRef.current
      if (crossfadeSeconds === 0 && nextTrack && standby && standby.readyState >= 2 && from && to && context) {
        const now = context.currentTime
        to.gain.cancelScheduledValues(now)
        to.gain.setValueAtTime(1, now)
        from.gain.cancelScheduledValues(now)
        from.gain.setValueAtTime(0, now)
        if (queueIds[0] === nextTrack.id) setQueueIds(items => items.slice(1))
        void standby.play().then(() => {
          audioRef.current = standby
          secondaryAudioRef.current = audio
          deckGainRef.current = to
          secondaryDeckGainRef.current = from
          audio.pause()
          preloadedTrackIdRef.current = ''
          setCurrentTrack(nextTrack)
          setCurrentTime(0)
          setDuration(nextTrack.duration || 0)
          setHistory(items => [nextTrack.id, ...items.filter(id => id !== nextTrack.id)].slice(0, 500))
          setIsPlaying(true)
        }).catch(() => void next())
      } else {
        void next()
      }
    }
    const onError = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement
      if (audio !== audioRef.current) return
      if (audio.error) setError('Не удалось воспроизвести файл. Проверьте формат и подключение к серверу.')
      setIsPlaying(false)
    }
    for (const deck of decks) {
      deck.addEventListener('timeupdate', onTime)
      deck.addEventListener('durationchange', onTime)
      deck.addEventListener('play', onPlay)
      deck.addEventListener('pause', onPause)
      deck.addEventListener('ended', onEnded)
      deck.addEventListener('error', onError)
    }
    return () => {
      for (const deck of decks) {
        deck.removeEventListener('timeupdate', onTime)
        deck.removeEventListener('durationchange', onTime)
        deck.removeEventListener('play', onPlay)
        deck.removeEventListener('pause', onPause)
        deck.removeEventListener('ended', onEnded)
        deck.removeEventListener('error', onError)
      }
    }
  }, [beginCrossfade, crossfadeSeconds, next, preloadGaplessNext, queueIds, repeat, transitionTrack])



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
    tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites, history, equalizer, equalizerPreset, setEqBand, setEqPreset, playlists, createPlaylist, addTrackToPlaylist,
    loading, error, connected, accessKey, setAccessKey, disconnect, refreshLibrary, scanLibrary, playTrack, togglePlay,
    next, previous, seek, setVolume, playOfflineTrack, crossfadeSeconds, setCrossfadeSeconds, exportData, importData, toggleShuffle: () => setShuffle(value => !value),
    cycleRepeat: () => setRepeat(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'),
    toggleFavorite, addToQueue, clearQueue, sleepTimer, setSleepTimer,
  }), [tracks, currentTrack, isPlaying, currentTime, duration, volume, shuffle, repeat, queue, favorites, history, equalizer, equalizerPreset, setEqBand, setEqPreset, playlists, createPlaylist, addTrackToPlaylist, loading, error, connected, accessKey, setAccessKey, disconnect, refreshLibrary, scanLibrary, playTrack, playOfflineTrack, togglePlay, next, previous, seek, setVolume, toggleFavorite, addToQueue, clearQueue, sleepTimer, setSleepTimer, crossfadeSeconds, setCrossfadeSeconds, exportData, importData])

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
      <audio ref={secondaryAudioRef} preload="metadata" />
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
