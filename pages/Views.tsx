import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlignLeft,
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
} from 'lucide-react'
import {
  albums,
  artists,
  covers,
  heroSlides,
  libraryFilters,
  nowPlaying,
  playlists,
  recentlyPlayed,
  type Album,
  type Track,
} from '@/data'
import { AppearanceControls, useAppearance } from '@/theme'
import { Cover, LibraryTiles, SectionHeader } from '@/components/Shell'
import { formatTime, usePlayer, type LibraryTrack } from '@/player/PlayerContext'

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
        <img src={cover} alt={title} loading="lazy" />
        <span className="cover-play" aria-hidden="true">
          <Play size={13} fill="currentColor" />
        </span>
      </div>
      <p className="mt-2.5 truncate text-[0.82rem] font-medium md:text-[0.9rem]">{title}</p>
      <p className="t-mute truncate text-[0.7rem] md:text-[0.76rem]">{subtitle}</p>
    </Link>
  )
}

function durationMinutes(tracks: Track[]) {
  const seconds = tracks.reduce((total, track) => {
    const [minutes = 0, secs = 0] = track.duration.split(':').map(Number)
    return total + minutes * 60 + secs
  }, 0)
  return Math.round(seconds / 60)
}

function TrackList({
  items,
  activeIndex = 1,
  withCover = false,
  showArtist = true,
}: {
  items: { title: string; artist?: string; duration: string; cover: string }[]
  activeIndex?: number
  withCover?: boolean
  showArtist?: boolean
}) {
  const [liked, setLiked] = useState<number[]>([])
  const toggleLike = (index: number) =>
    setLiked((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))

  return (
    <div className="overflow-hidden">
      {items.map((item, index) => {
        const active = index === activeIndex
        return (
          <div
            key={`${item.title}-${index}`}
            className={`group grid items-center gap-3 rounded-[calc(var(--r-radius)*0.7)] px-2.5 py-2.5 transition-colors md:px-3 ${
              withCover
                ? 'grid-cols-[1.6rem_2.4rem_minmax(0,1fr)_auto_auto_auto]'
                : 'grid-cols-[1.6rem_minmax(0,1fr)_auto_auto_auto]'
            } ${active ? 'bg-[var(--r-panel-2)]' : 'hover:bg-[var(--r-panel)]'}`}
          >
            <span
              className={`text-center text-[0.76rem] tabular-nums ${
                active ? 'accent-text' : 't-mute'
              }`}
            >
              {active ? (
                <span className="inline-flex h-3 items-end gap-[2px]" aria-label="Играет">
                  <span className="eq-bar accent-grad h-full w-[2px] rounded-full" />
                  <span
                    className="eq-bar accent-grad h-full w-[2px] rounded-full"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span
                    className="eq-bar accent-grad h-full w-[2px] rounded-full"
                    style={{ animationDelay: '0.4s' }}
                  />
                </span>
              ) : (
                index + 1
              )}
            </span>

            {withCover ? (
              <img
                src={item.cover}
                alt=""
                className="h-9 w-9 rounded-lg object-cover"
                loading="lazy"
              />
            ) : null}

            <div className="min-w-0">
              <p
                className={`truncate text-[0.86rem] font-medium ${
                  active ? 'accent-text' : 'text-[var(--r-text)]'
                }`}
              >
                {item.title}
              </p>
              {showArtist && item.artist ? (
                <p className="t-mute truncate text-[0.72rem]">{item.artist}</p>
              ) : null}
            </div>

            <span className="t-mute text-[0.75rem] tabular-nums">{item.duration}</span>

            <button
              type="button"
              onClick={() => toggleLike(index)}
              aria-label={liked.includes(index) ? 'Убрать из избранного' : 'В избранное'}
              aria-pressed={liked.includes(index)}
              className={`grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-[var(--r-panel-2)] ${
                liked.includes(index)
                  ? 'text-[var(--r-accent)]'
                  : 'text-[var(--r-text-mute)] opacity-0 group-hover:opacity-100'
              }`}
            >
              <Heart size={15} fill={liked.includes(index) ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              aria-label={`Ещё: ${item.title}`}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--r-text-mute)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)]"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
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
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % heroSlides.length)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [])

  const slide = heroSlides[index]

  return (
    <section className="relative overflow-hidden rounded-[var(--r-radius)] border border-[var(--r-line)]">
      <div className="absolute inset-0">
        {heroSlides.map((item, itemIndex) => (
          <div
            key={item.id}
            aria-hidden={itemIndex !== index}
            className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${
              itemIndex === index ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={item.cover}
              alt=""
              className={`h-full w-full object-cover transition-transform ease-out duration-[8000ms] ${
                itemIndex === index ? 'scale-105' : 'scale-100'
              }`}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,4,14,0.94)_0%,rgba(8,5,18,0.72)_46%,rgba(8,5,18,0.25)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,4,14,0.85)_0%,transparent_60%)]" />
      </div>

      <div className="relative flex min-h-[13.5rem] flex-col justify-end px-5 pb-10 pt-6 md:min-h-[16rem] md:justify-center md:px-9 md:py-8">
        <h2 className="text-[1.6rem] font-bold leading-[1.05] tracking-[-0.03em] md:text-[3.1rem]">
          {slide.title}
        </h2>
        <p className="t-dim mt-2 max-w-[26rem] text-[0.88rem] md:text-[1.02rem]">
          {slide.subtitle}
        </p>

        <div className="mt-5 flex items-center gap-2.5">
          <Link
            to="/player"
            className="accent-btn accent-ring inline-flex h-10 items-center gap-2 rounded-full px-5 text-[0.85rem] font-semibold transition-transform hover:scale-[1.03] md:h-11 md:px-6"
          >
            <Play size={15} fill="currentColor" />
            Слушать
          </Link>
          <Link
            to="/about"
            aria-label="О приложении"
            className="glass accent-ring grid h-10 w-10 place-items-center rounded-full text-white/90 transition-colors hover:text-white md:h-11 md:w-11"
          >
            <Info size={17} />
          </Link>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 md:bottom-6 md:left-auto md:right-7 md:translate-x-0">
        {heroSlides.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(itemIndex)}
            aria-label={`Слайд ${itemIndex + 1}: ${item.title}`}
            aria-current={itemIndex === index}
            className={`h-1.5 rounded-full transition-all ${
              itemIndex === index
                ? 'w-5 bg-[var(--r-accent)]'
                : 'w-1.5 bg-white/35 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

export function Home() {
  return (
    <div className="fade-up space-y-8">
      <Hero />

      <section>
        <SectionHeader title="Недавно прослушанные" to="/history" />
        <div className="media-grid row-mobile">
          {recentlyPlayed.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              subtitle={item.artist}
              cover={item.cover}
              to={`/albums/${item.albumId}`}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Моя библиотека" to="/library" actionLabel="Все разделы" />
        <LibraryTiles />
      </section>

      <section>
        <SectionHeader title="Плейлисты" to="/playlists" actionLabel="Все плейлисты" />
        <div className="media-grid">
          {playlists.slice(0, 5).map((playlist) => (
            <Link key={playlist.id} to="/player" className="cover-wrap group block">
              <div className="cover-art aspect-square">
                {playlist.cover ? (
                  <img src={playlist.cover} alt={playlist.title} loading="lazy" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: playlist.gradient }}
                  >
                    <Star size={38} className="text-white/90" fill="currentColor" />
                  </div>
                )}
                <span className="cover-play" aria-hidden="true">
                  <Play size={13} fill="currentColor" />
                </span>
              </div>
              <p className="mt-2.5 truncate text-[0.86rem] font-medium">{playlist.title}</p>
              <p className="t-mute truncate text-[0.74rem]">{playlist.count}</p>
            </Link>
          ))}
        </div>
      </section>
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
  const [query, setQuery] = useState('')
  const serverTracks = tracks.filter(track => [track.title, track.artist, track.album].some(value => value.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'new' ? b.year - a.year : a.artist.localeCompare(b.artist))

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

      <div className="mb-8">
        <LibraryTiles />
      </div>

      <section className="mb-8">
        <SectionHeader title="Недавно добавленные" to="/history" />
        <div className="media-grid row-mobile">
          {recentlyPlayed.map((item) => (
            <MediaCard
              key={item.title}
              title={item.title}
              subtitle={item.artist}
              cover={item.cover}
              to={`/albums/${item.albumId}`}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Альбомы" to="/albums" actionLabel="Все альбомы" />
        <div className="media-grid">
          {albums.slice(0, 5).map((album) => (
            <MediaCard
              key={album.id}
              title={album.title}
              subtitle={album.artist}
              cover={album.cover}
              to={`/albums/${album.id}`}
              ratio="square"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* ================================================================== */
/*  Альбомы                                                            */
/* ================================================================== */

export function Albums() {
  return (
    <div className="fade-up">
      <PageHead title="Альбомы" subtitle="Коллекции треков из вашей библиотеки" />
      <div className="media-grid">
        {albums.map((album) => (
          <MediaCard
            key={album.id}
            title={album.title}
            subtitle={`${album.artist} · ${album.year}`}
            cover={album.cover}
            to={`/albums/${album.id}`}
            ratio="square"
          />
        ))}
      </div>
    </div>
  )
}

export function AlbumDetail() {
  const { id } = useParams()
  const album: Album = albums.find((item) => item.id === id) ?? albums[0]
  const [liked, setLiked] = useState(false)

  return (
    <div className="fade-up">
      <Link
        to="/albums"
        className="t-dim mb-5 inline-flex items-center gap-1.5 text-[0.8rem] font-medium transition-colors hover:text-[var(--r-text)]"
      >
        <ArrowLeft size={15} />
        Альбом
      </Link>

      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="relative w-full max-w-[13rem] flex-none">
          <div className="accent-grad pulse-glow absolute -inset-5 rounded-[calc(var(--r-radius)*1.8)] opacity-25 blur-2xl" />
          <Cover
            src={album.cover}
            alt={`Обложка альбома ${album.title}`}
            className="relative aspect-square w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="t-mute text-[0.68rem] uppercase tracking-[0.16em]">Альбом</p>
          <h1 className="mt-1.5 text-[1.7rem] font-semibold leading-tight tracking-[-0.02em] md:text-[2.2rem]">
            {album.title}
          </h1>
          <p className="t-dim mt-1 text-[0.9rem]">{album.artist}</p>
          <p className="t-mute mt-2 text-[0.76rem]">
            {album.year} · {album.tracks.length} треков · {durationMinutes(album.tracks)} мин
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link
              to="/player"
              className="accent-btn accent-ring inline-flex h-10 items-center gap-2 rounded-full px-5 text-[0.84rem] font-semibold"
            >
              <Play size={15} fill="currentColor" />
              Слушать
            </Link>
            <button
              type="button"
              onClick={() => setLiked((value) => !value)}
              aria-pressed={liked}
              aria-label={liked ? 'Убрать из избранного' : 'В избранное'}
              className={`grid h-10 w-10 place-items-center rounded-full border transition-colors ${
                liked
                  ? 'border-transparent bg-[var(--r-panel-2)] text-[var(--r-accent)]'
                  : 'border-[var(--r-line)] text-[var(--r-text-dim)] hover:text-[var(--r-text)]'
              }`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              aria-label="Ещё"
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--r-line)] text-[var(--r-text-dim)] transition-colors hover:text-[var(--r-text)]"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      <TrackList
        items={album.tracks.map((track) => ({ ...track, artist: album.artist }))}
        showArtist={false}
      />
    </div>
  )
}

/* ================================================================== */
/*  Исполнители                                                        */
/* ================================================================== */

export function Artists() {
  return (
    <div className="fade-up">
      <PageHead title="Исполнители" subtitle="Все артисты вашей коллекции" />
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-5">
        {artists.map((artist) => (
          <Link key={artist.id} to="/albums" className="group block text-center">
            <div className="mx-auto aspect-square w-full overflow-hidden rounded-full border border-[var(--r-line)] transition-transform duration-500 group-hover:scale-[1.03]">
              <img
                src={artist.cover}
                alt={artist.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 truncate text-[0.88rem] font-medium">{artist.name}</p>
            <p className="t-mute text-[0.72rem]">Исполнитель</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Плейлисты                                                          */
/* ================================================================== */

export function Playlists() {
  return (
    <div className="fade-up">
      <PageHead title="Плейлисты" subtitle="Ваши музыкальные подборки">
        <button
          type="button"
          className="accent-ring inline-flex h-10 items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-4 text-[0.82rem] font-medium transition-colors hover:bg-[var(--r-panel-2)]"
        >
          <Plus size={15} />
          Создать плейлист
        </button>
      </PageHead>

      <div className="media-grid">
        {playlists.map((playlist) => (
          <Link key={playlist.id} to="/player" className="cover-wrap group block">
            <div className="cover-art aspect-square">
              {playlist.cover ? (
                <img src={playlist.cover} alt={playlist.title} loading="lazy" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: playlist.gradient }}
                >
                  <Star size={40} className="text-white/90" fill="currentColor" />
                </div>
              )}
              <span className="cover-play" aria-hidden="true">
                <Play size={13} fill="currentColor" />
              </span>
            </div>
            <p className="mt-2.5 truncate text-[0.86rem] font-medium">{playlist.title}</p>
            <p className="t-mute truncate text-[0.74rem]">{playlist.count}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Избранное / История / Офлайн                                       */
/* ================================================================== */

const flatTracks = albums.flatMap((album) =>
  album.tracks.map((track) => ({ ...track, artist: album.artist })),
)

export function Favorites() {
  return (
    <div className="fade-up">
      <PageHead title="Избранное" subtitle="Треки, которые вы отметили">
        <Link
          to="/player"
          className="accent-btn accent-ring inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.82rem] font-semibold"
        >
          <Play size={14} fill="currentColor" />
          Слушать всё
        </Link>
      </PageHead>
      <TrackList items={flatTracks.slice(0, 8)} withCover activeIndex={-1} />
    </div>
  )
}

export function History() {
  return (
    <div className="fade-up">
      <PageHead title="История" subtitle="Последние прослушанные треки" />
      <TrackList items={recentlyPlayed.map((item) => ({
        title: item.title,
        artist: item.artist,
        duration: '3:48',
        cover: item.cover,
      }))} withCover activeIndex={0} />
    </div>
  )
}

export function Offline() {
  return (
    <div className="fade-up">
      <PageHead title="Офлайн-загрузки" subtitle="Треки, доступные без подключения к сети">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] px-3 py-1.5 text-[0.76rem] text-[var(--r-text-dim)]">
          <Download size={14} />
          45 треков
        </span>
      </PageHead>
      <TrackList items={flatTracks.slice(3, 11)} withCover activeIndex={3} />
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
    shuffle, toggleShuffle, repeat, cycleRepeat, favorites, toggleFavorite, queue, addToQueue,
  } = usePlayer()
  const track = currentTrack || tracks[0] || null
  const liked = track ? favorites.includes(track.id) : false
  const progress = duration > 0 ? currentTime / duration : 0
  const bars = Math.round(waveHeights.length * progress)
  const glassBtn = 'grid place-items-center rounded-full border border-white/15 bg-white/10 text-white/85 backdrop-blur transition-colors hover:bg-white/20 hover:text-white'
  const cover = track ? `/api/cover/${encodeURIComponent(track.id)}` : covers.mountains

  return (
    <div className="reveal relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <img src={cover} alt="" className="ken-burns absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_38%,rgba(122,44,204,0.38),transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,4,14,0.74)_0%,rgba(7,4,14,0.4)_40%,rgba(5,3,10,0.94)_100%)]" />

      <header className="relative flex shrink-0 items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link to="/" aria-label="Назад" className={`${glassBtn} h-10 w-10`}><ArrowLeft size={18} /></Link>
        <div className="flex items-center gap-2">
          <button type="button" title={`Очередь: ${queue.length} треков`} className={`${glassBtn} h-10 w-10`}><ListMusic size={17} /></button>
          <button type="button" aria-label="Добавить текущий трек в очередь" onClick={() => track && addToQueue(track)} className={`${glassBtn} h-10 w-10`}><Plus size={17} /></button>
        </div>
      </header>

      <div className="scroll-y relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-2 text-center md:px-8">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">Сейчас играет</p>
        <h1 className="mt-2 max-w-full truncate text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white md:text-[3rem]">{track?.title || 'Resonance'}</h1>
        <p className="mt-1 text-[0.9rem] text-white/65 md:text-[1.05rem]">{track ? track.artist + ' · ' + track.album : 'Подключите сервер и выберите музыку в библиотеке'}</p>

        <div className="mt-6 flex h-12 w-full max-w-[34rem] items-end justify-center gap-[3px] md:mt-8 md:h-20" aria-hidden="true">
          {waveHeights.map((height, index) => <span key={index} className={`flex-1 rounded-full transition-colors ${index < bars ? 'accent-grad' : 'bg-white/15'} ${isPlaying ? 'wave-bar' : ''}`} style={{ height: `${height}%`, animationDelay: `${(index % 12) * 70}ms`, animationDuration: `${1 + (index % 5) * 0.16}s` }} />)}
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

      <footer className="relative hidden shrink-0 items-center justify-between gap-3 px-4 pb-5 pt-2 sm:flex md:px-8 md:pb-8">
        <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-[0.82rem] text-white/75 backdrop-blur">В очереди: {queue.length}</span>
        <span className="text-xs text-white/50">Формат: {track?.format || '—'}</span>
      </footer>
    </div>
  )
}

/* ================================================================== */
/*  Настройки                                                          */
/* ================================================================== */

export function Settings() {
  const { setPanelOpen } = useAppearance()

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
            <h3 className="text-[0.92rem] font-semibold">Статус прототипа</h3>
            <p className="t-dim mt-2 text-[0.78rem] leading-relaxed">
              Это фронтенд-макет: свёрстаны экраны, состояния и адаптив. Воспроизведение,
              авторизация и загрузки появятся на следующем этапе.
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
