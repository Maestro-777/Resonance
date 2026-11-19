import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlignLeft,
  AudioLines,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Info,
  ListFilter,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react'
import {
  covers,
  libraryFilters,
} from '@/data'
import { AppearanceControls, useAppearance } from '@/theme'
import { Cover, SectionHeader } from '@/components/Shell'
import { formatTime, usePlayer, type LibraryTrack } from '@/player/PlayerContext'
import { deleteOfflineTrack, listOfflineTracks, saveOfflineTrack, type OfflineTrackRecord } from '@/lib/offline'

/* ================================================================== */
/*  Вспомогательные блоки                                              */
/* ================================================================== */

function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.02em] md:text-[2rem]">{title}</h1>
        {subtitle ? <p className="t-dim mt-1 text-[0.86rem] md:text-[0.92rem]">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function MediaCard({
  title,
  subtitle,
  cover,
  to,
  ratio = 'wide',
}: {
  title: string
  subtitle: string
  cover: string
  to: string
  ratio?: 'wide' | 'square'
}) {
  return (
    <Link to={to} className="cover-wrap lift group block">
      <div className={`cover-art ${ratio === 'wide' ? 'aspect-[4/3]' : 'aspect-square'}`}>
        <img src={cover} alt={title} loading="lazy" onError={event => { event.currentTarget.src = '/cover-fallback.svg' }} />
        <span className="cover-play" aria-hidden="true">
          <Play size={13} fill="currentColor" />
        </span>
      </div>
      <p className="mt-2.5 truncate text-[0.82rem] font-medium md:text-[0.9rem]">{title}</p>
      <p className="t-mute truncate text-[0.7rem] md:text-[0.76rem]">{subtitle}</p>
    </Link>
  )
}

type MetadataBackup = { id: string; filename: string; trackId: string; createdAt: string; size: number }

function parseLrc(content: string) {
  return content.split(/\r?\n/).flatMap(line => {
    const stamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    const text = line.replace(/\[\d+:(?:\d+(?:\.\d+)?)\]/g, '').trim()
    return stamps.map(match => ({ time: Number(match[1]) * 60 + Number(match[2]), text })).filter(item => item.text)
  }).sort((a, b) => a.time - b.time)
}

function makeSlug(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '')
}

function durationMinutes(tracks: Track[]) {
  const seconds = tracks.reduce((total, track) => {
    const [minutes = 0, secs = 0] = track.duration.split(':').map(Number)
    return total + minutes * 60 + secs
  }, 0)
  return Math.round(seconds / 60)
}

function ServerTrackRows({ items }: { items: LibraryTrack[] }) {
  const { currentTrack, isPlaying, playTrack, togglePlay, toggleFavorite, favorites, addToQueue } = usePlayer()
  if (!items.length) return <p className="t-dim rounded-xl border border-dashed border-[var(--r-line)] p-5 text-sm">В музыкальной папке пока не найдено аудиофайлов. Проверьте путь MUSIC_ROOT и запустите сканирование в настройках.</p>
  return (
    <div className="space-y-1">
      {items.map((track, index) => {
        const active = currentTrack?.id === track.id
        const liked = favorites.includes(track.id)
        return (
          <div key={track.id} className={`group grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors ${active ? 'bg-[var(--r-panel-2)]' : 'hover:bg-[var(--r-panel)]'}`}>
            <span className="t-mute text-center text-xs tabular-nums">{active && isPlaying ? <AudioLines size={15} className="mx-auto accent-text" /> : index + 1}</span>
            <img src={`/api/cover/${encodeURIComponent(track.id)}`} onError={event => { event.currentTarget.style.visibility = 'hidden' }} alt="" className="h-10 w-10 rounded-lg bg-[var(--r-panel-2)] object-cover" />
            <button type="button" onClick={() => active ? void togglePlay() : void playTrack(track)} className="min-w-0 text-left">
              <span className={`block truncate text-sm font-medium ${active ? 'accent-text' : ''}`}>{track.title}</span>
              <span className="t-mute block truncate text-xs">{track.artist} · {track.album}</span>
            </button>
            <span className="t-mute hidden text-xs tabular-nums sm:block">{formatTime(track.duration)}</span>
            <button type="button" onClick={() => toggleFavorite(track.id)} aria-label={liked ? 'Убрать из избранного' : 'В избранное'} aria-pressed={liked} className={`grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--r-panel-2)] ${liked ? 'text-[var(--r-accent)]' : 't-mute'}`}><Heart size={15} fill={liked ? 'currentColor' : 'none'} /></button>
            <button type="button" onClick={() => addToQueue(track)} aria-label="Добавить в очередь" className="grid h-8 w-8 place-items-center rounded-full t-mute hover:bg-[var(--r-panel-2)]"><Plus size={16} /></button>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/*  Главная                                                            */
/* ================================================================== */

function Hero() {
  const { tracks, connected, loading } = usePlayer()
  const albumCount = new Set(tracks.map(track => `${track.album}__${track.albumArtist || track.artist}`)).size
  const artistCount = new Set(tracks.map(track => track.albumArtist || track.artist)).size
  return (
    <section className="panel relative overflow-hidden p-6 md:p-9">
      <div className="accent-grad absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-15 blur-3xl" />
      <div className="relative">
        <p className="t-mute text-xs uppercase tracking-[0.18em]">Resonance · твоя музыкальная библиотека</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">{connected ? 'Вся твоя музыка — в одном месте' : 'Подключи свою музыкальную коллекцию'}</h1>
        <p className="t-dim mt-3 max-w-xl text-sm md:text-base">{connected ? `${tracks.length} треков · ${albumCount} альбомов · ${artistCount} исполнителей` : 'Resonance покажет только настоящие аудиофайлы из выбранной папки на твоём компьютере. Демо-музыки здесь больше нет.'}</p>
        {!connected ? <Link to="/settings" className="accent-btn mt-5 inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold">Подключить музыкальный сервер</Link> : <Link to="/library" className="accent-btn mt-5 inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold">Открыть библиотеку</Link>}
        {loading ? <p className="t-mute mt-3 text-xs">Подключение к серверу…</p> : null}
      </div>
    </section>
  )
}

export function Home() {
  const { tracks, connected, history, playlists: userPlaylists } = usePlayer()
  const recent = (history.length ? history : tracks.map(track => track.id)).map(id => tracks.find(track => track.id === id)).filter((track): track is LibraryTrack => Boolean(track)).slice(0, 8)
  const albumCount = new Set(tracks.map(track => `${track.album}__${track.albumArtist || track.artist}`)).size
  const artistCount = new Set(tracks.map(track => track.albumArtist || track.artist)).size
  return (
    <div className="fade-up space-y-8">
      <Hero />
      {connected ? <>
        <section>
          <SectionHeader title="Твоя музыка" to="/library" actionLabel="Вся библиотека" />
          {recent.length ? <ServerTrackRows items={recent} /> : <p className="t-dim text-sm">Библиотека подключена. Запусти любой трек, и здесь появится история прослушивания.</p>}
        </section>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[['Треки', tracks.length, '/library'], ['Альбомы', albumCount, '/albums'], ['Исполнители', artistCount, '/artists']].map(([label, count, to]) => <Link key={label} to={String(to)} className="panel panel-hover p-4"><p className="t-mute text-xs">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p></Link>)}
        </section>
        {userPlaylists.length ? <section><SectionHeader title="Твои плейлисты" to="/playlists" actionLabel="Все плейлисты" /><div className="grid gap-3 sm:grid-cols-2">{userPlaylists.slice(0, 4).map(playlist => <Link key={playlist.id} to="/playlists" className="panel panel-hover p-4"><p className="font-medium">{playlist.name}</p><p className="t-mute mt-1 text-xs">{playlist.trackIds.length} треков</p></Link>)}</div></section> : null}
      </> : <section className="panel p-5"><h2 className="font-semibold">Пока нет подключённой библиотеки</h2><p className="t-dim mt-2 text-sm">Вымышленные альбомы и треки не отображаются. Подключи локальный сервер и просканируй папку с музыкой.</p><Link to="/settings" className="accent-text mt-3 inline-flex text-sm font-medium">Перейти к настройке сервера →</Link></section>}
    </div>
  )
}

/* ================================================================== */
/*  Библиотека                                                         */
/* ================================================================== */

export function Library() {
  const [filter, setFilter] = useState<string>(libraryFilters[0])
  const [sort, setSort] = useState('default')
  const { tracks, connected } = usePlayer()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  useEffect(() => { setQuery(searchParams.get('q') || '') }, [searchParams])
  const serverTracks = tracks.filter(track => [track.title, track.artist, track.album].some(value => value.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'new' ? (b.year ?? 0) - (a.year ?? 0) : a.artist.localeCompare(b.artist))

  return (
    <div className="fade-up">
      <PageHead title="Моя библиотека" subtitle="Вся ваша музыка в одном месте">
        <label className="relative inline-flex items-center">
          <ListFilter
            size={15}
            className="pointer-events-none absolute left-3.5 text-[var(--r-text-mute)]"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Сортировка"
            className="h-10 appearance-none rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] pl-9 pr-9 text-base text-[var(--r-text)] outline-none transition-colors hover:border-[var(--r-line-2)] focus:border-[color:rgb(var(--r-accent-rgb)/0.6)] md:text-[0.8rem]"
          >
            <option value="default">По умолчанию</option>
            <option value="new">Сначала новые</option>
            <option value="title">По названию</option>
          </select>
          <ChevronRight
            size={15}
            className="pointer-events-none absolute right-3 rotate-90 text-[var(--r-text-mute)]"
          />
        </label>
      </PageHead>

      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {libraryFilters.map((item) => {
          const active = item === filter
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              aria-pressed={active}
              className={`accent-ring whitespace-nowrap rounded-full px-4 py-2 text-[0.8rem] font-medium transition-colors ${
                active
                  ? 'accent-grad text-white accent-shadow'
                  : 'border border-[var(--r-line-2)] text-[var(--r-text)] hover:bg-[var(--r-panel)]'
              }`}
            >
              {item}
            </button>
          )
        })}
      </div>

      {connected ? (
        <section className="panel mb-8 p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Музыка на сервере</h2>
              <p className="t-mute mt-1 text-xs">{tracks.length} треков в вашей музыкальной папке</p>
            </div>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти трек, альбом или исполнителя" aria-label="Поиск по музыкальной библиотеке" className="h-9 w-full max-w-xs rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-sm outline-none focus:border-[var(--r-accent)]" />
          </div>
          <ServerTrackRows items={serverTracks} />
        </section>
      ) : (
        <div className="panel mb-8 p-4 text-sm t-dim">
          Подключите музыкальный сервер в настройках, чтобы увидеть настоящую библиотеку и начать воспроизведение.
          <Link to="/settings" className="ml-2 accent-text">Настроить сервер</Link>
        </div>
      )}

      {connected ? <p className="t-mute text-xs">Показаны только файлы, найденные при последнем сканировании музыкальной папки.</p> : null}
    </div>
  )
}

/* ================================================================== */
/*  Альбомы                                                            */
/* ================================================================== */

export function Albums() {
  const { tracks, connected } = usePlayer()
  const serverAlbums = Array.from(tracks.reduce((map, track) => {
    const key = `${track.album}__${track.albumArtist || track.artist}`
    const current = map.get(key) || []
    current.push(track)
    map.set(key, current)
    return map
  }, new Map<string, LibraryTrack[]>()), ([key, items]) => ({ id: makeSlug(key), title: items[0].album, artist: items[0].albumArtist || items[0].artist, year: items.find(item => item.year)?.year || '', tracks: items, cover: `/api/cover/${encodeURIComponent(items[0].id)}` }))
  return (
    <div className="fade-up">
      <PageHead title="Альбомы" subtitle={connected ? `${serverAlbums.length} альбомов в вашей библиотеке` : 'Коллекции треков из вашей библиотеки'} />
      {connected ? (serverAlbums.length ? <div className="media-grid">{serverAlbums.map(album => <MediaCard key={album.id} title={album.title} subtitle={`${album.artist} · ${album.year || 'год неизвестен'}`} cover={album.cover} to={`/albums/${album.id}`} ratio="square" />)}</div> : <p className="t-dim text-sm">В просканированной папке пока не найдено альбомов.</p>) : <p className="t-dim text-sm">Подключи сервер, чтобы увидеть реальные альбомы. Демонстрационные записи скрыты.</p>}
    </div>
  )
}

export function AlbumDetail() {
  const { id } = useParams()
  const { tracks, connected, playTrack } = usePlayer()
  const serverTracks = tracks.filter(track => makeSlug(`${track.album}__${track.albumArtist || track.artist}`) === id)
  const albumTitle = serverTracks[0]?.album || 'Альбом не найден'
  const albumArtist = serverTracks[0]?.albumArtist || serverTracks[0]?.artist || ''
  const cover = serverTracks[0] ? `/api/cover/${encodeURIComponent(serverTracks[0].id)}` : '/cover-fallback.svg'

  return (
    <div className="fade-up">
      <Link to="/albums" className="t-dim mb-5 inline-flex items-center gap-1.5 text-[0.8rem] font-medium transition-colors hover:text-[var(--r-text)]"><ArrowLeft size={15} />Альбомы</Link>
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="relative w-full max-w-[13rem] flex-none">
          <div className="accent-grad pulse-glow absolute -inset-5 rounded-[calc(var(--r-radius)*1.8)] opacity-25 blur-2xl" />
          <Cover src={cover} alt={`Обложка альбома ${albumTitle}`} className="relative aspect-square w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="t-mute text-[0.68rem] uppercase tracking-[0.16em]">Альбом</p>
          <h1 className="mt-1.5 text-[1.7rem] font-semibold leading-tight tracking-[-0.02em] md:text-[2.2rem]">{albumTitle}</h1>
          <p className="t-dim mt-1 text-[0.9rem]">{albumArtist}</p>
          <p className="t-mute mt-2 text-[0.76rem]">{serverTracks.length ? `${serverTracks[0].year || 'Год неизвестен'} · ${serverTracks.length} треков` : 'Нет данных из музыкального сервера'}</p>
          <button type="button" disabled={!serverTracks.length} onClick={() => void playTrack(serverTracks[0])} className="accent-btn accent-ring mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[0.84rem] font-semibold disabled:opacity-40"><Play size={15} fill="currentColor" />Слушать альбом</button>
        </div>
      </div>
      {serverTracks.length ? <ServerTrackRows items={serverTracks} /> : <p className="t-dim">{connected ? 'Альбом не найден в текущей библиотеке.' : 'Подключи сервер, чтобы просматривать реальные альбомы.'}</p>}
    </div>
  )
}

/* ================================================================== */
/*  Исполнители                                                        */
/* ================================================================== */

export function Artists() {
  const { tracks, connected } = usePlayer()
  const serverArtists = Array.from(tracks.reduce((map, track) => {
    const name = track.albumArtist || track.artist
    const current = map.get(name) || []
    current.push(track)
    map.set(name, current)
    return map
  }, new Map<string, LibraryTrack[]>()), ([name, items]) => ({ id: makeSlug(name), name, count: items.length, cover: `/api/cover/${encodeURIComponent(items[0].id)}` }))
  const list = connected ? serverArtists : []
  return (
    <div className="fade-up">
      <PageHead title="Исполнители" subtitle={connected ? `${list.length} исполнителей в вашей коллекции` : 'Подключи сервер, чтобы увидеть исполнителей из своих аудиофайлов'} />
      {list.length ? <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
        {list.map(artist => (
          <Link key={artist.id} to={connected ? `/artists/${artist.id}` : "/albums"} className="group block text-center">
            <div className="mx-auto aspect-square w-full overflow-hidden rounded-full border border-[var(--r-line)] transition-transform duration-500 group-hover:scale-[1.03]">
              <img src={artist.cover} alt={artist.name} loading="lazy" onError={event => { event.currentTarget.src = '/cover-fallback.svg' }} className="h-full w-full object-cover" />
            </div>
            <p className="mt-3 truncate text-[0.88rem] font-medium">{artist.name}</p>
            <p className="t-mute text-[0.72rem]">{connected ? `${artist.count} треков` : 'Исполнитель'}</p>
          </Link>
        ))}
      </div> : <p className="t-dim text-sm">{connected ? 'Исполнители не найдены.' : 'Демонстрационные исполнители скрыты.'}</p>}
    </div>
  )
}

export function ArtistDetail() {
  const { id } = useParams()
  const { tracks, connected } = usePlayer()
  const items = tracks.filter(track => makeSlug(track.albumArtist || track.artist) === id)
  const name = items[0]?.albumArtist || items[0]?.artist || 'Исполнитель'
  return (
    <div className="fade-up">
      <Link to="/artists" className="t-dim mb-5 inline-flex items-center gap-1.5 text-[0.8rem] font-medium hover:text-[var(--r-text)]"><ArrowLeft size={15} />Исполнители</Link>
      <PageHead title={name} subtitle={connected ? `${items.length} треков в библиотеке` : 'Подключи сервер для просмотра музыки'} />
      {items.length ? <ServerTrackRows items={items} /> : <p className="t-dim">{connected ? 'Треки этого исполнителя пока не найдены.' : 'Данные исполнителей появятся после подключения сервера.'}</p>}
    </div>
  )
}

/* ================================================================== */
/*  Плейлисты                                                          */
/* ================================================================== */

export function Playlists() {
  const { tracks, playlists: userPlaylists, createPlaylist, addTrackToPlaylist, playTrack } = usePlayer()
  const [name, setName] = useState('')
  const [targetId, setTargetId] = useState('')
  const create = () => {
    const id = createPlaylist(name)
    if (id) { setTargetId(id); setName('') }
  }
  return (
    <div className="fade-up">
      <PageHead title="Плейлисты" subtitle="Ваши музыкальные подборки" />
      <section className="panel mb-6 p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold">Новая подборка</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create() }} placeholder="Название плейлиста" aria-label="Название плейлиста" className="h-10 min-w-0 flex-1 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-sm outline-none focus:border-[var(--r-accent)]" />
          <button type="button" disabled={!name.trim()} onClick={create} className="accent-btn inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40"><Plus size={15} />Создать</button>
        </div>
      </section>
      {userPlaylists.length ? (
        <section className="panel mb-6 p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold">Мои плейлисты</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {userPlaylists.map(playlist => {
              const items = playlist.trackIds.map(id => tracks.find(track => track.id === id)).filter((track): track is LibraryTrack => Boolean(track))
              return <div key={playlist.id} className="rounded-xl border border-[var(--r-line)] p-3">
                <p className="font-medium">{playlist.name}</p>
                <p className="t-mute mt-1 text-xs">{items.length} треков</p>
                {items.length ? <div className="mt-2 space-y-1">{items.slice(0, 5).map(track => <button key={track.id} type="button" onClick={() => void playTrack(track)} className="block w-full truncate text-left text-xs t-dim hover:accent-text">{track.title} — {track.artist}</button>)}</div> : <p className="t-mute mt-2 text-xs">Пока нет треков</p>}
              </div>
            })}
          </div>
        </section>
      ) : null}
      {userPlaylists.length && tracks.length ? (
        <section className="panel mb-6 p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold">Добавить музыку в плейлист</h2>
          <select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="Выберите плейлист" className="mb-3 h-10 w-full rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-sm">
            <option value="">Выберите плейлист</option>
            {userPlaylists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="space-y-1">
            {tracks.slice(0, 30).map(track => <div key={track.id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{track.title} <span className="t-mute">· {track.artist}</span></span>
              <button type="button" disabled={!targetId || userPlaylists.find(item => item.id === targetId)?.trackIds.includes(track.id)} onClick={() => addTrackToPlaylist(targetId, track.id)} className="rounded-full border border-[var(--r-line)] px-3 py-1.5 text-xs disabled:opacity-40">Добавить</button>
            </div>)}
          </div>
        </section>
      ) : null}

    </div>
  )
}

/* ================================================================== */
/*  Избранное / История / Офлайн                                       */
/* ================================================================== */

export function Favorites() {
  const { tracks, favorites, playTrack } = usePlayer()
  const items = favorites.map(id => tracks.find(track => track.id === id)).filter((track): track is LibraryTrack => Boolean(track))
  return (
    <div className="fade-up">
      <PageHead title="Избранное" subtitle={`${items.length} сохранённых треков`}>
        <button type="button" disabled={!items.length} onClick={() => void playTrack(items[0])} className="accent-btn accent-ring inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.82rem] font-semibold disabled:opacity-40"><Play size={14} fill="currentColor" />Слушать всё</button>
      </PageHead>
      <ServerTrackRows items={items} />
    </div>
  )
}

export function History() {
  const { tracks, history } = usePlayer()
  const items = history.map(id => tracks.find(track => track.id === id)).filter((track): track is LibraryTrack => Boolean(track))
  return (
    <div className="fade-up">
      <PageHead title="История" subtitle={`${items.length} недавно прослушанных треков`} />
      <ServerTrackRows items={items} />
    </div>
  )
}


export function Offline() {
  const { tracks, accessKey, playOfflineTrack } = usePlayer()
  const [saved, setSaved] = useState<OfflineTrackRecord[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const refresh = () => listOfflineTracks().then(setSaved).catch(cause => setMessage(cause instanceof Error ? cause.message : 'Не удалось открыть офлайн-хранилище.'))
  useEffect(() => { void refresh() }, [])
  const save = async (track: LibraryTrack) => {
    setBusyId(track.id)
    setMessage('')
    try {
      await saveOfflineTrack({
        id: track.id, title: track.title, artist: track.artist, album: track.album,
        duration: track.duration, format: track.format, year: track.year, genre: track.genre,
      }, `/api/stream/${encodeURIComponent(track.id)}`, accessKey)
      await refresh()
      setMessage('Трек сохранён на этом устройстве.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Не удалось сохранить трек.')
    } finally {
      setBusyId(null)
    }
  }
  const playSaved = (record: OfflineTrackRecord) => {
    const item = record.track
    const track: LibraryTrack = {
      id: item.id, title: item.title, artist: item.artist, album: item.album, albumArtist: item.artist,
      track: null, year: item.year, genre: item.genre, duration: item.duration, format: item.format,
      replayGainDb: null, size: record.size, relativePath: '', hasEmbeddedPicture: false,
    }
    void playOfflineTrack(track, record.blob)
  }
  const remove = async (id: string) => {
    await deleteOfflineTrack(id)
    await refresh()
  }

  return (
    <div className="fade-up">
      <PageHead title="Офлайн-загрузки" subtitle="Музыка, сохранённая в памяти этого устройства">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-3 py-1.5 text-[0.76rem] text-[var(--r-text-dim)]"><Download size={14} />{saved.length} треков</span>
      </PageHead>
      {message ? <p role="status" className="mb-4 text-sm t-dim">{message}</p> : null}
      {saved.length ? (
        <div className="panel mb-6 p-3">
          {saved.map(record => (
            <div key={record.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--r-panel)]">
              <button type="button" onClick={() => playSaved(record)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{record.track.title}</span>
                <span className="t-mute block truncate text-xs">{record.track.artist} · {formatTime(record.track.duration)} · {(record.size / 1024 / 1024).toFixed(1)} МБ</span>
              </button>
              <button type="button" onClick={() => void remove(record.id)} aria-label="Удалить офлайн-трек" className="rounded-full p-2 t-mute hover:bg-[var(--r-panel-2)]"><MoreHorizontal size={17} /></button>
            </div>
          ))}
        </div>
      ) : <p className="panel mb-6 p-5 text-sm t-dim">Здесь пока пусто. Сохраните треки ниже, чтобы слушать их без подключения к серверу.</p>}
      <section className="panel p-4 md:p-5">
        <h2 className="mb-3 text-base font-semibold">Доступные для загрузки</h2>
        {!accessKey ? <p className="t-dim text-sm">Сначала подключите сервер в настройках.</p> : tracks.length ? (
          <div className="space-y-1">
            {tracks.map(track => {
              const isSaved = saved.some(item => item.id === track.id)
              return <div key={track.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{track.title}</span><span className="t-mute block truncate text-xs">{track.artist} · {formatTime(track.duration)}</span></span>
                <button type="button" disabled={isSaved || busyId === track.id} onClick={() => void save(track)} className="rounded-full border border-[var(--r-line)] px-3 py-1.5 text-xs font-medium disabled:opacity-40">{isSaved ? 'Сохранён' : busyId === track.id ? 'Загрузка…' : 'Скачать'}</button>
              </div>
            })}
          </div>
        ) : <p className="t-dim text-sm">Музыкальная библиотека пуста.</p>}
      </section>
    </div>
  )
}

/* ================================================================== */
/*  Полноэкранный плеер                                                */
/* ================================================================== */

const waveHeights = Array.from({ length: 72 }).map(
  (_, index) => 18 + Math.abs(Math.sin(index * 0.55) * Math.cos(index * 0.21)) * 82,
)

export function Player() {
  const {
    currentTrack, tracks, isPlaying, currentTime, duration, togglePlay, next, previous, seek,
    shuffle, toggleShuffle, repeat, cycleRepeat, favorites, toggleFavorite, queue, addToQueue, clearQueue, removeFromQueue, playTrack, accessKey, sleepTimer, setSleepTimer, volume, setVolume, error, getSpectrum,
  } = usePlayer()
  const track = currentTrack || tracks[0] || null
  const liked = track ? favorites.includes(track.id) : false
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [liveBars, setLiveBars] = useState<number[]>(waveHeights)
  useEffect(() => {
    if (!isPlaying) { setLiveBars(waveHeights); return }
    let frame = 0
    let lastUpdate = 0
    const draw = (now: number) => {
      if (now - lastUpdate >= 90) {
        const values = getSpectrum()
        if (values.length) setLiveBars(values)
        lastUpdate = now
      }
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [getSpectrum, isPlaying])
  useEffect(() => {
    let active = true
    setLyrics(null)
    setShowLyrics(false)
    if (track && accessKey) {
      void fetch(`/api/lyrics/${encodeURIComponent(track.id)}`, { headers: { 'x-resonance-key': accessKey } })
        .then(response => response.ok ? response.text() : null)
        .then(value => { if (active) setLyrics(value) })
        .catch(() => { if (active) setLyrics(null) })
    }
    return () => { active = false }
  }, [track?.id, accessKey])
  const progress = duration > 0 ? currentTime / duration : 0
  const timedLyrics = lyrics ? parseLrc(lyrics) : []
  const activeLyricIndex = timedLyrics.findIndex((line, index) => currentTime >= line.time && (index === timedLyrics.length - 1 || currentTime < timedLyrics[index + 1].time))
  const bars = Math.round(liveBars.length * progress)
  const glassBtn = 'grid place-items-center rounded-full border border-white/15 bg-white/10 text-white/85 backdrop-blur transition-colors hover:bg-white/20 hover:text-white'
  const cover = track ? `/api/cover/${encodeURIComponent(track.id)}` : '/cover-fallback.svg'

  return (
    <div className="reveal relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <img src={cover} onError={event => { event.currentTarget.src = '/cover-fallback.svg' }} alt="" className="ken-burns absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_38%,rgba(122,44,204,0.38),transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,4,14,0.74)_0%,rgba(7,4,14,0.4)_40%,rgba(5,3,10,0.94)_100%)]" />

      <header className="relative flex shrink-0 items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link to="/" aria-label="Назад" className={`${glassBtn} h-10 w-10`}><ArrowLeft size={18} /></Link>
        <div className="flex items-center gap-2">
          <button type="button" title={`Очередь: ${queue.length} треков`} aria-pressed={showQueue} onClick={() => setShowQueue(value => !value)} className={`${glassBtn} h-10 w-10`}><ListMusic size={17} /></button>
          <button type="button" aria-label="Добавить текущий трек в очередь" onClick={() => track && addToQueue(track)} className={`${glassBtn} h-10 w-10`}><Plus size={17} /></button>
        </div>
      </header>

      <div className="scroll-y relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-2 text-center md:px-8">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">Сейчас играет</p>
        <h1 className="mt-2 max-w-full truncate text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white md:text-[3rem]">{track?.title || 'Resonance'}</h1>
        <p className="mt-1 text-[0.9rem] text-white/65 md:text-[1.05rem]">{track ? track.artist + ' · ' + track.album : 'Подключите сервер и выберите музыку в библиотеке'}</p>
        {error ? <p role="status" className="mt-2 text-xs text-rose-200/90">{error}</p> : null}

        <div className="mt-6 flex h-12 w-full max-w-[34rem] items-end justify-center gap-[3px] md:mt-8 md:h-20" aria-hidden="true">
          {liveBars.map((height, index) => <span key={index} className={`flex-1 rounded-full transition-colors ${index < bars ? 'accent-grad' : 'bg-white/15'} ${isPlaying ? 'wave-bar' : ''}`} style={{ height: `${height}%`, animationDelay: `${(index % 12) * 70}ms`, animationDuration: `${1 + (index % 5) * 0.16}s` }} />)}
        </div>

        <div className="mt-5 w-full max-w-[34rem]">
          <input type="range" min={0} max={Math.max(1, duration)} step={0.1} value={Math.min(currentTime, duration || 0)} aria-label="Позиция воспроизведения" disabled={!track} onChange={event => seek(Number(event.target.value))} className="r-range" style={{ ['--_p' as string]: `${progress * 100}%` } as CSSProperties} />
          <div className="mt-2 flex justify-between text-[0.7rem] tabular-nums text-white/55"><span>{formatTime(currentTime)}</span><span>{formatTime(duration || track?.duration || 0)}</span></div>
        </div>

        <div className="mt-4 flex w-full max-w-[32rem] items-center justify-center gap-2.5 md:mt-6 md:gap-3.5">
          <div className="flex items-center gap-2 md:gap-3.5">
            <button type="button" onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Перемешать" className={`grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/12 ${shuffle ? 'text-[var(--r-accent)]' : 'text-white/75 hover:text-white'}`}><Shuffle size={17} /></button>
            <button type="button" onClick={() => void previous()} aria-label="Предыдущий трек" className="grid h-10 w-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white"><SkipBack size={19} fill="currentColor" /></button>
            <button type="button" onClick={() => void togglePlay()} disabled={!track} aria-label={isPlaying ? 'Пауза' : 'Слушать'} className={`accent-btn grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-40 ${isPlaying ? 'playing-glow' : ''}`}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
            <button type="button" onClick={() => void next()} aria-label="Следующий трек" className="grid h-10 w-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white"><SkipForward size={19} fill="currentColor" /></button>
            <button type="button" onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={`Повтор: ${repeat}`} className={`grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/12 ${repeat !== 'off' ? 'text-[var(--r-accent)]' : 'text-white/75 hover:text-white'}`}><Repeat size={17} /></button>
          </div>
          <button type="button" onClick={() => track && toggleFavorite(track.id)} disabled={!track} aria-pressed={liked} aria-label={liked ? 'Убрать из избранного' : 'В избранное'} className={`grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/12 ${liked ? 'text-[var(--r-accent)]' : 'text-white/80 hover:text-white'}`}><Heart size={19} fill={liked ? 'currentColor' : 'none'} /></button>
        </div>
      </div>

      {showQueue && (
        <div className="relative mx-auto mb-3 max-h-44 w-[min(90%,36rem)] overflow-y-auto rounded-2xl border border-white/15 bg-black/35 p-3 text-left text-white/85 backdrop-blur">
          <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Очередь · {queue.length}</span><button type="button" onClick={clearQueue} className="text-xs text-white/60 hover:text-white">Очистить</button></div>
          {queue.length ? queue.map((item, index) => <div key={item.id + index} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10"><button type="button" onClick={() => void playTrack(item)} className="min-w-0 flex-1 truncate text-left text-sm">{index + 1}. {item.title} <span className="text-white/50">— {item.artist}</span></button><button type="button" onClick={() => removeFromQueue(item.id)} aria-label="Убрать из очереди" className="rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"><X size={13} /></button></div>) : <p className="text-xs text-white/55">Очередь пуста. Добавляйте треки кнопкой «+» в библиотеке.</p>}
        </div>
      )}
      {showLyrics && (
        <div className="relative mx-auto mb-3 max-h-40 w-[min(90%,36rem)] overflow-y-auto rounded-2xl border border-white/15 bg-black/35 p-4 text-left text-sm leading-relaxed text-white/85 backdrop-blur">
          {lyrics ? (timedLyrics.length ? <div className="space-y-2">{timedLyrics.map((line, index) => <p key={index} className={`transition-colors ${index === activeLyricIndex ? 'text-white font-semibold' : 'text-white/55'}`}>{line.text}</p>)}</div> : <pre className="whitespace-pre-wrap font-sans">{lyrics}</pre>) : <p className="text-white/60">Для этого трека текст песни не найден. Добавьте рядом с аудиофайлом файл .lrc или .txt.</p>}
        </div>
      )}
      <footer className="relative flex shrink-0 items-center justify-between gap-3 px-4 pb-5 pt-2 sm:px-6 md:px-8 md:pb-8">
        <button type="button" onClick={() => setShowLyrics(value => !value)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-[0.82rem] font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"><AlignLeft size={15} />Текст песни</button>
        <div className="flex flex-wrap items-center gap-3">
          {sleepTimer ? <span className="text-xs text-white/60">Таймер сна включён до {new Date(sleepTimer).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
          <select value="" onChange={event => setSleepTimer(event.target.value ? Number(event.target.value) : null)} aria-label="Таймер сна" className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/85 backdrop-blur">
            <option value="">Таймер сна…</option>
            <option value="15">Остановить через 15 минут</option>
            <option value="30">Остановить через 30 минут</option>
            <option value="45">Остановить через 45 минут</option>
            <option value="60">Остановить через час</option>
            <option value="90">Остановить через 90 минут</option>
            <option value="0">Отключить таймер</option>
          </select>
          <label className="inline-flex items-center gap-2 text-white/70">
            <Volume2 size={15} />
            <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={event => setVolume(Number(event.target.value) / 100)} aria-label="Громкость" className="r-range w-20" style={{ ['--_p' as string]: `${volume * 100}%` } as CSSProperties} />
          </label>
          <span className="text-xs text-white/50">В очереди: {queue.length} · {track?.format || '—'}</span>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================== */
/*  Настройки                                                          */
/* ================================================================== */

export function Settings() {
  const { setPanelOpen } = useAppearance()
  const { connected, accessKey, setAccessKey, scanLibrary, refreshLibrary, disconnect, loading, tracks, error, equalizer, equalizerPreset, setEqBand, setEqPreset, crossfadeSeconds, setCrossfadeSeconds, exportData, importData } = usePlayer()
  const [serverKey, setServerKey] = useState('')
  const [serverMessage, setServerMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [metadataBackups, setMetadataBackups] = useState<MetadataBackup[]>([])
  const [editTrackId, setEditTrackId] = useState('')
  const [metadata, setMetadata] = useState({ title: '', artist: '', album: '', genre: '', year: '', trackNumber: '' })
  const [metadataMessage, setMetadataMessage] = useState('')
  const [coverData, setCoverData] = useState('')
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [serverHealth, setServerHealth] = useState<{ musicRoot?: string; trackCount?: number; lastScan?: string | null } | null>(null)

  const loadMetadataBackups = async () => {
    if (!connected || !accessKey) return
    try {
      const response = await fetch('/api/backups', { headers: { 'x-resonance-key': accessKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось загрузить резервные копии')
      setMetadataBackups(Array.isArray(result.backups) ? result.backups : [])
    } catch (cause) {
      setMetadataMessage(cause instanceof Error ? cause.message : 'Ошибка загрузки резервных копий')
    }
  }

  useEffect(() => {
    let active = true
    fetch('/api/health', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (active) setServerHealth(value) })
      .catch(() => { if (active) setServerHealth(null) })
    return () => { active = false }
  }, [connected, loading]) 

  useEffect(() => {
    void loadMetadataBackups()
  }, [connected, accessKey])

  const restoreBackupFile = async (backup: MetadataBackup) => {
    setSavingMetadata(true)
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.filename)}/restore`, { method: 'POST', headers: { 'x-resonance-key': accessKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось восстановить копию')
      await refreshLibrary()
      await loadMetadataBackups()
      setMetadataMessage('Резервная копия восстановлена. Перед восстановлением создана копия текущего файла.')
    } catch (cause) {
      setMetadataMessage(cause instanceof Error ? cause.message : 'Ошибка восстановления')
    } finally {
      setSavingMetadata(false)
    }
  }

  useEffect(() => {
    if (!editTrackId || !accessKey) return
    let active = true
    setMetadataMessage('')
    void fetch(`/api/metadata/${encodeURIComponent(editTrackId)}`, { headers: { 'x-resonance-key': accessKey } })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Не удалось прочитать теги')
        if (active) setMetadata({ title: result.title || '', artist: result.artist || '', album: result.album || '', genre: result.genre || '', year: result.year ? String(result.year) : '', trackNumber: result.trackNumber ? String(result.trackNumber) : '' })
      })
      .catch(cause => { if (active) setMetadataMessage(cause instanceof Error ? cause.message : 'Ошибка чтения тегов') })
    return () => { active = false }
  }, [editTrackId, accessKey])

  const saveTags = async () => {
    if (!editTrackId) return
    setSavingMetadata(true)
    setMetadataMessage('')
    try {
      const response = await fetch(`/api/metadata/${encodeURIComponent(editTrackId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-resonance-key': accessKey },
        body: JSON.stringify(coverData ? { ...metadata, coverData } : metadata),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить теги')
      await refreshLibrary()
      await loadMetadataBackups()
      setCoverData('')
      setMetadataMessage('Теги сохранены. Резервная копия исходного файла создана.')
    } catch (cause) {
      setMetadataMessage(cause instanceof Error ? cause.message : 'Ошибка записи тегов')
    } finally {
      setSavingMetadata(false)
    }
  }

  const restoreTags = async () => {
    if (!editTrackId) return
    setSavingMetadata(true)
    try {
      const response = await fetch(`/api/metadata/${encodeURIComponent(editTrackId)}/restore`, { method: 'POST', headers: { 'x-resonance-key': accessKey } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось восстановить копию')
      await refreshLibrary()
      setMetadataMessage('Последняя резервная копия восстановлена.')
    } catch (cause) {
      setMetadataMessage(cause instanceof Error ? cause.message : 'Ошибка восстановления')
    } finally {
      setSavingMetadata(false)
    }
  }

  return (
    <div className="fade-up">
      <PageHead
        title="Настройки"
        subtitle="Настройте внешний вид плеера: цвет, фон, форму и плотность"
      >
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="accent-ring inline-flex h-10 items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-[0.82rem] font-medium transition-colors hover:bg-[var(--r-panel-2)]"
        >
          Открыть панель
        </button>
      </PageHead>

      <section className="panel mb-5 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Музыкальный сервер</h2>
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] ${connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--r-panel-2)] t-dim'}`}>{connected ? 'Подключён' : 'Не подключён'}</span>
            </div>
            <p className="t-dim mt-1 text-sm">Сервер читает реальные аудиофайлы с компьютера. Ключ находится в файле <code>server/.env</code>; в Windows его можно открыть кнопкой «Где взять ключ?» ниже.</p>
            {serverHealth?.musicRoot ? <p className="t-mute mt-2 break-all text-xs">Папка музыки: {serverHealth.musicRoot}</p> : null}
            {connected ? <p className="t-mute mt-2 text-xs">{tracks.length} реальных треков загружено в библиотеку</p> : null}
          </div>
          {connected ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={disconnect} className="rounded-full border border-[var(--r-line)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--r-panel-2)]">Отключить сервер</button>
              <button type="button" disabled={loading} onClick={() => { setServerMessage(''); void scanLibrary().then(() => setServerMessage(`Готово. Найдено треков: ${tracks.length}.`)).catch(cause => setServerMessage(cause instanceof Error ? cause.message : 'Ошибка сканирования.')) }} className="accent-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{loading ? 'Сканирование папки…' : 'Обновить мои треки'}</button>
              <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--r-line)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--r-panel-2)]">
                {uploading ? 'Загрузка…' : 'Загрузить музыку'}
                <input type="file" accept="audio/*,.flac,.opus,.aiff" multiple disabled={uploading} className="sr-only" onChange={event => {
                  const files = event.target.files
                  if (!files?.length) return
                  const body = new FormData()
                  Array.from(files).forEach(file => body.append('files', file))
                  setUploading(true)
                  setServerMessage('')
                  void fetch('/api/uploads', { method: 'POST', headers: { 'x-resonance-key': accessKey }, body }).then(async response => {
                    const result = await response.json()
                    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить файлы')
                    return refreshLibrary().then(() => setServerMessage(`Загружено файлов: ${result.uploaded}`))
                  }).catch(cause => setServerMessage(cause instanceof Error ? cause.message : 'Ошибка загрузки')).finally(() => setUploading(false))
                  event.target.value = ''
                }} />
              </label>
            </div>
          ) : null}
        </div>
        {!connected ? <div className="mt-3"><a href="file:///C:/not-a-real-path" className="hidden" aria-hidden="true">.</a><p className="text-xs t-mute">Открой файл server/.env в папке Resonance на компьютере. Нужна строка RESONANCE_ACCESS_KEY=…</p></div> : null}
        {!connected ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input type="password" autoComplete="current-password" value={serverKey} onChange={event => setServerKey(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { void setAccessKey(serverKey).then(() => { setServerKey(''); setServerMessage('Сервер подключён.') }).catch(cause => setServerMessage(cause instanceof Error ? cause.message : 'Не удалось подключиться.')) } }} placeholder="Ключ доступа Resonance" aria-label="Ключ доступа сервера" className="h-10 min-w-0 flex-1 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-sm outline-none focus:border-[var(--r-accent)]" />
            <button type="button" disabled={!serverKey.trim() || loading} onClick={() => { void setAccessKey(serverKey).then(() => { setServerKey(''); setServerMessage('Сервер подключён.') }).catch(cause => setServerMessage(cause instanceof Error ? cause.message : 'Не удалось подключиться.')) }} className="accent-btn rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Подключить</button>
          </div>
        ) : null}
        {!connected ? <p className="mt-3 text-xs t-mute">После установки нажми «Где взять ключ?», скопируй значение RESONANCE_ACCESS_KEY из server/.env, вставь его сюда и нажми «Подключить».</p> : null}
        {serverMessage || error ? <p role="status" className="mt-3 text-sm text-[var(--r-text-dim)]">{serverMessage || error}</p> : null}
        {accessKey && !connected ? <p className="t-mute mt-2 text-xs">Ключ сохранён в этом браузере. Проверьте, что сервер запущен на этом компьютере.</p> : null}
      </section>

      {connected ? (
        <section className="panel mb-5 p-4 md:p-5">
          <h2 className="text-base font-semibold">Редактор метаданных</h2>
          <p className="t-dim mt-1 text-sm">Изменяйте название, исполнителя, альбом, жанр, год и номер дорожки. Перед записью сервер сохраняет оригинал.</p>
          <select value={editTrackId} onChange={event => setEditTrackId(event.target.value)} aria-label="Трек для редактирования" className="mt-4 h-10 w-full rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-sm">
            <option value="">Выберите трек</option>
            {tracks.filter(track => ['MP3', 'FLAC', 'M4A', 'OGG', 'OPUS'].includes(track.format)).map(track => <option key={track.id} value={track.id}>{track.title} — {track.artist} ({track.format})</option>)}
          </select>
          {editTrackId ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(['title', 'artist', 'album', 'genre', 'year', 'trackNumber'] as const).map(field => (
                <label key={field} className="block">
                  <span className="t-mute mb-1 block text-xs">{({ title: 'Название', artist: 'Исполнитель', album: 'Альбом', genre: 'Жанр', year: 'Год', trackNumber: 'Номер дорожки' })[field]}</span>
                  <input value={metadata[field]} onChange={event => setMetadata(value => ({ ...value, [field]: event.target.value }))} className="h-10 w-full rounded-xl border border-[var(--r-line)] bg-[var(--r-panel)] px-3 text-sm outline-none focus:border-[var(--r-accent)]" />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="t-mute mb-1 block text-xs">Новая обложка (JPG или PNG, до 8 МБ)</span>
                <input type="file" accept="image/jpeg,image/png" onChange={event => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (file.size > 8 * 1024 * 1024) { setMetadataMessage('Обложка должна быть не больше 8 МБ.'); event.target.value = ''; return }
                  const reader = new FileReader()
                  reader.onload = () => setCoverData(typeof reader.result === 'string' ? reader.result : '')
                  reader.onerror = () => setMetadataMessage('Не удалось прочитать изображение.')
                  reader.readAsDataURL(file)
                  event.target.value = ''
                }} className="block w-full text-sm t-dim file:mr-3 file:rounded-full file:border-0 file:bg-[var(--r-panel-2)] file:px-4 file:py-2 file:text-xs file:font-medium file:text-[var(--r-text)]" />
                {coverData ? <span className="mt-1 block text-xs text-emerald-400">Обложка готова к сохранению</span> : null}
              </label>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                <button type="button" disabled={savingMetadata} onClick={() => void saveTags()} className="accent-btn rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{savingMetadata ? 'Сохранение…' : 'Сохранить теги'}</button>
                <button type="button" disabled={savingMetadata} onClick={() => void restoreTags()} className="rounded-full border border-[var(--r-line)] px-4 py-2.5 text-sm disabled:opacity-50">Восстановить копию</button>
              </div>
            </div>
          ) : null}
          {metadataMessage ? <p role="status" className="mt-3 text-sm t-dim">{metadataMessage}</p> : null}
        </section>
      ) : null}

      {connected ? (
        <section className="panel mb-5 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">Резервные копии тегов</h2><p className="t-dim mt-1 text-xs">{metadataBackups.length} копий сохранено на компьютере</p></div>
            <button type="button" onClick={() => void loadMetadataBackups()} className="rounded-full border border-[var(--r-line)] px-3 py-1.5 text-xs">Обновить</button>
          </div>
          {metadataBackups.length ? <div className="space-y-1">{metadataBackups.slice(0, 12).map(backup => {
            const track = tracks.find(item => item.id === backup.trackId)
            return <div key={backup.filename} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--r-panel)]">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{track?.title || backup.filename}</span><span className="t-mute block text-xs">{new Date(backup.createdAt).toLocaleString()} · {(backup.size / 1024 / 1024).toFixed(1)} МБ</span></span>
              <button type="button" disabled={savingMetadata} onClick={() => void restoreBackupFile(backup)} className="rounded-full border border-[var(--r-line)] px-3 py-1.5 text-xs disabled:opacity-40">Восстановить</button>
            </div>
          })}</div> : <p className="t-dim text-sm">Резервные копии появятся после первого сохранения тегов.</p>}
        </section>
      ) : null}

      <section className="panel mb-5 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Переход между треками</h2>
            <p className="t-dim mt-1 text-sm">Плавное перекрытие двух аудиодеков или gapless-переход при нулевом значении</p>
          </div>
          <span className="text-sm font-semibold tabular-nums">{crossfadeSeconds} сек.</span>
        </div>
        <input type="range" min={0} max={8} step={1} value={crossfadeSeconds} onChange={event => setCrossfadeSeconds(Number(event.target.value))} aria-label="Длительность crossfade" className="r-range mt-4 w-full" style={{ ['--_p' as string]: `${crossfadeSeconds / 8 * 100}%` } as CSSProperties} />
      </section>

      <section className="panel mb-5 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Эквалайзер</h2>
            <p className="t-dim mt-1 text-sm">10 полос Web Audio · ReplayGain применяется автоматически, если теги есть в файле</p>
          </div>
          <select value={equalizerPreset} onChange={event => setEqPreset(event.target.value)} aria-label="Пресет эквалайзера" className="h-9 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-3 text-sm">
            {['Пользовательский', 'Плоский', 'Басы', 'Рок', 'Классика', 'Джаз', 'Голос'].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-3 sm:grid-cols-10">
          {['32', '64', '125', '250', '500', '1000', '2000', '4000', '8000', '16000'].map(frequency => (
            <label key={frequency} className="flex flex-col items-center gap-2">
              <span className="t-mute text-[0.66rem] tabular-nums">{equalizer[frequency] > 0 ? '+' : ''}{equalizer[frequency] || 0} dB</span>
              <input type="range" min={-12} max={12} step={1} value={equalizer[frequency] || 0} onChange={event => setEqBand(frequency, Number(event.target.value))} aria-label={`Эквалайзер ${frequency} Гц`} className="h-24 w-5 accent-[var(--r-accent)] [writing-mode:vertical-lr] [direction:rtl]" />
              <span className="t-mute text-[0.65rem]">{Number(frequency) >= 1000 ? `${Number(frequency) / 1000}k` : frequency}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
        <div>
          <h2 className="text-base font-semibold">Резервная копия коллекции</h2>
          <p className="t-dim mt-1 text-sm">Экспорт и импорт избранного, плейлистов, истории, очереди и настроек звука. Аудиофайлы не включаются.</p>
          {backupMessage ? <p role="status" className="mt-2 text-xs t-dim">{backupMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => {
            const blob = new Blob([exportData()], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `resonance-backup-${new Date().toISOString().slice(0, 10)}.json`
            link.click()
            URL.revokeObjectURL(url)
            setBackupMessage('Резервная копия подготовлена.')
          }} className="rounded-full border border-[var(--r-line)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--r-panel-2)]">Экспортировать JSON</button>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--r-line)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--r-panel-2)]">
            Импортировать JSON
            <input type="file" accept="application/json,.json" className="sr-only" onChange={event => {
              const file = event.target.files?.[0]
              if (!file) return
              void file.text().then(importData).then(() => setBackupMessage('Данные восстановлены.')).catch(cause => setBackupMessage(cause instanceof Error ? cause.message : 'Не удалось импортировать файл.'))
              event.target.value = ''
            }} />
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel p-5 md:p-6">
          <AppearanceControls />
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <p className="t-mute mb-3 text-[0.66rem] uppercase tracking-[0.16em]">Предпросмотр</p>
            <div className="glass rounded-[calc(var(--r-radius)*0.9)] p-3">
              <div className="flex items-center gap-3">
                <img
                  src={covers.ocean}
                  alt="Обложка трека в предпросмотре"
                  className="h-12 w-12 rounded-[calc(var(--r-radius)*0.5)] object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[0.84rem] font-medium">Ocean Breath</p>
                  <p className="t-mute truncate text-[0.7rem]">Deep Sound</p>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/12">
                <div className="accent-grad h-full w-2/3 rounded-full" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="accent-btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
                >
                  <Play size={11} fill="currentColor" />
                  Слушать
                </button>
                <span className="rounded-full border border-[var(--r-line)] px-3 py-1.5 text-[0.72rem] text-[var(--r-text-dim)]">
                  В библиотеку
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="text-[0.92rem] font-semibold">Как это работает</h3>
            <ul className="t-dim mt-3 space-y-2.5 text-[0.78rem] leading-relaxed">
              <li>Параметры применяются сразу ко всем экранам приложения.</li>
              <li>Значения сохраняются в этом браузере и восстанавливаются при следующем визите.</li>
              <li>Готовые значения можно забрать как CSS-переменные из блока «Токены темы».</li>
            </ul>
          </div>

          <div className="panel p-5">
            <h3 className="text-[0.92rem] font-semibold">Локальная библиотека</h3>
            <p className="t-dim mt-2 text-[0.78rem] leading-relaxed">
              Музыкальные файлы остаются на вашем компьютере. Веб-интерфейс получает метаданные и аудиопоток от локального сервера; ключ доступа хранится только в этом браузере.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  О приложении                                                       */
/* ================================================================== */

export function About() {
  return (
    <div className="fade-up mx-auto max-w-3xl">
      <div className="panel overflow-hidden">
        <div className="relative px-6 py-8 md:px-9 md:py-10">
          <div className="accent-grad pulse-glow absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="accent-grad accent-shadow grid h-12 w-12 place-items-center rounded-2xl">
              <Sparkles size={20} className="text-white" />
            </span>
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Resonance</h1>
              <p className="t-mute text-[0.72rem] uppercase tracking-[0.18em]">Музыкальный плеер</p>
            </div>
          </div>
          <p className="t-dim relative mt-5 max-w-xl text-[0.9rem] leading-relaxed">
            Тёмный интерфейс музыкального плеера: главная с подборками, библиотека, альбомы,
            полноэкранный плеер и гибкая настройка оформления.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          {
            title: 'Экраны',
            text: 'Главная, библиотека, альбомы, исполнители, плейлисты, избранное, история, офлайн и полноэкранный плеер.',
          },
          {
            title: 'Оформление',
            text: 'Акцентный цвет, четыре варианта фона, радиус, размытие стекла, свечение, плотность и масштаб.',
          },
          {
            title: 'Адаптивность',
            text: 'Отдельные раскладки для десктопа, планшета и телефона с нижней навигацией.',
          },
          {
            title: 'Статус',
            text: 'Только фронтенд: воспроизведение и хранение музыки не подключены.',
          },
        ].map((item) => (
          <div key={item.title} className="panel p-5">
            <h2 className="text-[0.92rem] font-semibold">{item.title}</h2>
            <p className="t-dim mt-2 text-[0.8rem] leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      <p className="t-mute mt-5 text-[0.72rem] leading-relaxed">
        Демо-контент: названия треков, исполнителей и обложки используются как заполнители для
        макета.
      </p>

      <Link
        to="/"
        className="accent-btn accent-ring mt-6 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[0.84rem] font-semibold"
      >
        <ChevronLeft size={15} />
        На главную
      </Link>
    </div>
  )
}

/* ================================================================== */
/*  404                                                                */
/* ================================================================== */

export function NotFound() {
  return (
    <div className="fade-up grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="accent-text text-[3rem] font-bold leading-none">404</p>
        <h1 className="mt-3 text-[1.2rem] font-semibold">Страница не найдена</h1>
        <p className="t-dim mt-2 text-[0.86rem]">Возможно, раздел ещё не готов.</p>
        <Link
          to="/"
          className="accent-btn accent-ring mt-5 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[0.84rem] font-semibold"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
