import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AudioLines,
  Bell,
  ChevronRight,
  Clock,
  Download,
  Heart,
  ListMusic,
  Maximize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  covers,
  libraryTiles,
  mainNav,
  secondaryNav,
  type LibraryTile,
} from '@/data'
import { AppearancePanel, useAppearance, type ThemeId } from '@/theme'
import { formatTime, usePlayer } from '@/player/PlayerContext'

/* ================================================================== */
/*  Общие элементы                                                     */
/* ================================================================== */

export function Cover({
  src,
  alt,
  className = '',
  rounded,
}: {
  src: string
  alt: string
  className?: string
  rounded?: string
}) {
  return (
    <div
      className={`cover-art ${className}`}
      style={rounded ? { borderRadius: rounded } : undefined}
    >
      <img src={src} alt={alt} loading="lazy" />
    </div>
  )
}

export function SectionHeader({
  title,
  to,
  actionLabel = 'Все треки',
}: {
  title: string
  to?: string
  actionLabel?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-[1.08rem] font-semibold tracking-[-0.01em] md:text-[1.42rem]">{title}</h2>
      {to ? (
        <Link
          to={to}
          className="group inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--r-text-dim)] transition-colors hover:text-[var(--r-text)]"
        >
          {actionLabel}
          <ChevronRight
            size={15}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  )
}

const tileIcons = {
  heart: Heart,
  clock: Clock,
  music: Music2,
  download: Download,
}

export function LibraryTiles({ tiles = libraryTiles }: { tiles?: LibraryTile[] }) {
  return (
    <div className="tiles-grid stagger">
      {tiles.map((tile) => {
        const Icon = tileIcons[tile.icon]
        return (
          <Link
            key={tile.label}
            to={tile.to}
            className="panel panel-hover lift tile group flex items-center gap-3 p-3.5"
          >
            <span
              className="tile-icon grid h-11 w-11 flex-none place-items-center rounded-xl"
              style={{
                background: `${tile.color}26`,
                boxShadow: `0 10px 26px -18px ${tile.glow}`,
              }}
            >
              <Icon size={19} style={{ color: tile.color }} />
            </span>
            <span className="min-w-0">
              <span className="tile-label block truncate text-[0.9rem] font-medium">
                {tile.label}
              </span>
              <span className="tile-count t-mute block truncate text-[0.74rem]">{tile.count}</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/*  Боковая панель                                                     */
/* ================================================================== */

function Sidebar() {
  const { appearance } = useAppearance()
  const showLabels = appearance.labels

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.86rem] font-medium transition-colors ${
      isActive
        ? 'nav-active'
        : 'text-[var(--r-text-dim)] hover:bg-[var(--r-panel)] hover:text-[var(--r-text)]'
    } ${showLabels ? '' : 'justify-center px-0'}`

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-[var(--r-line)] px-3.5 py-5 lg:flex ${
        showLabels ? 'w-[14.6rem]' : 'w-[4.9rem]'
      }`}
    >
      <Link
        to="/"
        className={`mb-6 flex items-center gap-2.5 ${showLabels ? 'px-1.5' : 'justify-center'}`}
        aria-label="Resonance — на главную"
      >
        <span
          className="accent-text grid h-10 w-10 flex-none place-items-center"
          style={{ filter: 'drop-shadow(0 6px 16px rgb(var(--r-accent-rgb) / 0.55))' }}
        >
          <AudioLines size={26} strokeWidth={2.1} />
        </span>
        {showLabels ? (
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] font-semibold leading-tight">
              Resonance
            </span>
            <span className="t-mute block text-[0.58rem] uppercase tracking-[0.2em]">
              Музыкальный плеер
            </span>
          </span>
        ) : null}
      </Link>

      <nav className="scroll-y min-h-0 flex flex-1 flex-col gap-1" aria-label="Основная навигация">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={item.label}
            className={navClass}
          >
            <item.icon
              size={19}
              className="flex-none transition-transform duration-300 group-hover:scale-110"
            />
            {showLabels ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        ))}

        <div className="my-3 border-t border-[var(--r-line)]" />

        {secondaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} title={item.label} className={navClass}>
            <item.icon
              size={19}
              className="flex-none transition-transform duration-300 group-hover:scale-110"
            />
            {showLabels ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      {showLabels ? (
        <Link
          to="/offline"
          className="lift relative mt-5 overflow-hidden rounded-[var(--r-radius)] border border-white/10 p-3.5 hover:border-[color:rgb(var(--r-accent-rgb)/0.4)]"
          style={{
            backgroundImage:
              'radial-gradient(140% 110% at 10% 0%, rgba(139,92,246,0.55), transparent 62%), linear-gradient(160deg, rgba(139,92,246,0.32), rgba(20,10,35,0.9))',
          }}
        >
          <div className="mb-3 flex h-10 items-end gap-[3px]" aria-hidden="true">
            {Array.from({ length: 30 }).map((_, index) => (
              <span
                key={index}
                className="eq-bar w-[2px] flex-1 rounded-full bg-white/70"
                style={{
                  height: `${22 + Math.abs(Math.sin(index * 1.27)) * 74}%`,
                  animationDelay: `${(index % 9) * 0.11}s`,
                  animationDuration: `${1.1 + (index % 5) * 0.16}s`,
                }}
              />
            ))}
          </div>
          <p className="text-[0.86rem] font-semibold leading-snug">
            Твоя музыка
            <br />
            всегда с тобой
          </p>
          <span className="t-dim mt-2 flex items-center gap-1 text-[0.7rem]">
            Офлайн-режим
            <ChevronRight size={13} />
          </span>
        </Link>
      ) : null}
    </aside>
  )
}

/* ================================================================== */
/*  Верхняя панель                                                     */
/* ================================================================== */

const themeOrder: ThemeId[] = ['night', 'amethyst', 'graphite', 'oled']

function Topbar() {
  const { appearance, update, setPanelOpen } = useAppearance()

  const cycleTheme = () => {
    const index = themeOrder.indexOf(appearance.theme)
    update('theme', themeOrder[(index + 1) % themeOrder.length])
  }

  return (
    <header className="flex shrink-0 items-center gap-3 px-4 py-3.5 md:px-6 md:py-5">
      <Link
        to="/"
        className="flex items-center gap-2 md:hidden"
        aria-label="Resonance — на главную"
      >
        <span
          className="accent-text grid h-8 w-8 place-items-center"
          style={{ filter: 'drop-shadow(0 4px 12px rgb(var(--r-accent-rgb) / 0.5))' }}
        >
          <AudioLines size={21} strokeWidth={2.1} />
        </span>
        <span className="text-[0.95rem] font-semibold">Resonance</span>
      </Link>

      <label className="group relative hidden min-w-0 flex-1 items-center md:flex md:max-w-[30rem]">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 text-[var(--r-text-mute)] transition-colors group-focus-within:text-[var(--r-accent)]"
        />
        <input
          type="search"
          placeholder="Поиск музыки…"
          aria-label="Поиск музыки"
          className="h-11 w-full rounded-full border border-[var(--r-line)] bg-[var(--r-panel)] pl-11 pr-4 text-base text-[var(--r-text)] outline-none transition-colors placeholder:text-[var(--r-text-mute)] hover:border-[var(--r-line-2)] focus:border-[color:rgb(var(--r-accent-rgb)/0.65)] focus:bg-[var(--r-panel-2)] md:text-[0.9rem]"
        />
      </label>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
        <button
          type="button"
          onClick={cycleTheme}
          title="Сменить фон приложения"
          aria-label="Сменить фон приложения"
          className="accent-ring hidden h-9 w-9 place-items-center rounded-full text-[var(--r-text-dim)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)] md:grid"
        >
          <Sun size={18} />
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          title="Настройки внешнего вида"
          aria-label="Настройки внешнего вида"
          className="accent-ring hidden h-9 w-9 place-items-center rounded-full text-[var(--r-text-dim)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)] md:grid"
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          type="button"
          title="Уведомления"
          aria-label="Уведомления"
          className="accent-ring grid h-9 w-9 place-items-center rounded-full text-[var(--r-text-dim)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)]"
        >
          <Bell size={18} />
        </button>
        <button
          type="button"
          title="Профиль слушателя"
          aria-label="Профиль слушателя"
          className="accent-ring ml-0.5 h-9 w-9 overflow-hidden rounded-full border border-[var(--r-line-2)] transition-transform hover:scale-105"
        >
          <img src={covers.portrait} alt="Аватар слушателя" className="h-full w-full object-cover" />
        </button>
      </div>
    </header>
  )
}

/* ================================================================== */
/*  Плеер                                                              */
/* ================================================================== */

function PlayingBars({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className="inline-flex h-3 flex-none items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="eq-bar accent-grad h-full w-[2px] rounded-full"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </span>
  )
}

function PlayerBar({ compact = false }: { compact?: boolean }) {
  const {
    currentTrack, isPlaying, togglePlay, next, previous, currentTime, duration,
    volume, setVolume, shuffle, toggleShuffle, repeat, cycleRepeat,
  } = usePlayer()
  const circleBtn =
    'grid place-items-center rounded-full text-[var(--r-text-dim)] transition-colors hover:bg-[var(--r-panel-2)] hover:text-[var(--r-text)]'
  const title = currentTrack?.title || 'Выберите трек'
  const artist = currentTrack?.artist || 'Библиотека Resonance'
  const cover = currentTrack ? `/api/cover/${encodeURIComponent(currentTrack.id)}` : '/icon-192.svg'

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <Link to="/player" className="flex min-w-0 flex-1 items-center gap-2.5">
          <img src={cover} alt="Обложка трека" className="h-10 w-10 flex-none rounded-lg object-cover" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <PlayingBars active={isPlaying} />
              <span className="truncate text-[0.82rem] font-medium leading-tight">{title}</span>
            </span>
            <span className="t-mute block truncate text-[0.68rem]">{artist}</span>
          </span>
        </Link>
        <button type="button" onClick={() => void togglePlay()} disabled={!currentTrack} aria-label={isPlaying ? 'Пауза' : 'Слушать'} className={`accent-btn grid h-9 w-9 place-items-center rounded-full ${isPlaying ? 'playing-glow' : ''} disabled:opacity-40`}>
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <Link to="/player" aria-label="Открыть плеер" className="grid h-9 w-9 place-items-center text-[var(--r-text-dim)]"><ListMusic size={17} /></Link>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-[var(--r-line)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 py-4 md:px-6">
        <Link to="/player" className="group flex min-w-0 items-center gap-3">
          <img src={cover} alt="Обложка трека" className="h-[3.25rem] w-[3.25rem] flex-none rounded-xl object-cover shadow-[0_10px_24px_-12px_rgba(0,0,0,0.9)]" />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <PlayingBars active={isPlaying} />
              <span className="truncate text-[0.86rem] font-medium leading-tight transition-colors group-hover:text-[var(--r-accent)]">{title}</span>
            </span>
            <span className="t-mute block truncate text-[0.72rem]">{artist}</span>
          </span>
        </Link>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 md:gap-2.5">
            <button type="button" onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Перемешать" className={`${circleBtn} h-9 w-9 ${shuffle ? 'text-[var(--r-accent)]' : ''}`}><Shuffle size={16} /></button>
            <button type="button" onClick={() => void previous()} aria-label="Предыдущий трек" className={`${circleBtn} h-9 w-9`}><SkipBack size={17} fill="currentColor" /></button>
            <button type="button" onClick={() => void togglePlay()} disabled={!currentTrack} aria-label={isPlaying ? 'Пауза' : 'Слушать'} className={`accent-btn grid h-12 w-12 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-40 ${isPlaying ? 'playing-glow' : ''}`}>
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button type="button" onClick={() => void next()} aria-label="Следующий трек" className={`${circleBtn} h-9 w-9`}><SkipForward size={17} fill="currentColor" /></button>
            <button type="button" onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={`Повтор: ${repeat}`} className={`${circleBtn} h-9 w-9 ${repeat !== 'off' ? 'text-[var(--r-accent)]' : ''}`}><Repeat size={16} /></button>
          </div>
          <div className="flex w-full max-w-[22rem] items-center gap-2">
            <span className="t-mute text-[0.64rem] tabular-nums">{formatTime(currentTime)}</span>
            <input type="range" min={0} max={Math.max(1, duration)} step={0.1} value={Math.min(currentTime, duration || 0)} aria-label="Позиция воспроизведения" disabled={!currentTrack} onChange={event => {
              const audio = document.querySelector('audio')
              if (audio) audio.currentTime = Number(event.target.value)
            }} className="r-range min-w-0 flex-1" style={{ ['--_p' as string]: `${duration ? currentTime / duration * 100 : 0}%` } as CSSProperties} />
            <span className="t-mute text-[0.64rem] tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Volume2 size={16} className="text-[var(--r-text-dim)]" />
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} aria-label="Громкость" onChange={event => setVolume(Number(event.target.value) / 100)} className="r-range hidden w-[6.5rem] md:block" style={{ ['--_p' as string]: `${volume * 100}%` } as CSSProperties} />
          <Link to="/settings" aria-label="Настройки звука" className={`${circleBtn} hidden h-9 w-9 xl:grid`}><AudioLines size={16} /></Link>
          <Link to="/player" aria-label="Открыть полноэкранный плеер" className={`${circleBtn} hidden h-9 w-9 xl:grid`}><Maximize2 size={16} /></Link>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Нижняя навигация (мобильные)                                       */
/* ================================================================== */

const mobileNav = [
  { to: '/', label: 'Главная', icon: mainNav[0].icon },
  { to: '/library', label: 'Библиотека', icon: mainNav[1].icon },
  { to: '/playlists', label: 'Плейлисты', icon: mainNav[6].icon },
  { to: '/settings', label: 'Настройки', icon: secondaryNav[0].icon },
]

function MobileDock() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--r-line)] backdrop-blur-xl lg:hidden"
      style={{ background: 'color-mix(in srgb, var(--r-app) 92%, transparent)' }}
    >
      <PlayerBar compact />
      <nav className="flex items-center justify-around px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex w-full flex-col items-center gap-1 rounded-lg py-1.5 text-[0.62rem] font-medium transition-colors ${
                isActive ? 'text-[var(--r-accent)]' : 'text-[var(--r-text-mute)]'
              }`
            }
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/* ================================================================== */
/*  Макет приложения                                                   */
/* ================================================================== */

export default function AppShell() {
  const { pathname } = useLocation()
  const immersive = pathname === '/player'
  const mainRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])

  return (
    <div className="app-canvas p-0 md:p-3">
      <div className="app-window mx-auto flex h-[100dvh] max-w-[110rem] overflow-hidden md:h-[calc(100dvh-1.5rem)]">
        {immersive ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        ) : (
          <>
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main
                ref={mainRef}
                className="scroll-y min-h-0 flex-1 px-4 pb-40 md:px-6 lg:pb-6"
              >
                <Outlet />
              </main>
              <div className="hidden lg:block">
                <PlayerBar />
              </div>
            </div>
          </>
        )}
      </div>
      {immersive ? null : <MobileDock />}
      <AppearancePanel />
    </div>
  )
}
