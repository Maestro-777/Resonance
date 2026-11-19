import {
  Disc3,
  Download,
  Heart,
  History,
  Home,
  Info,
  Library,
  ListMusic,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

/* Обложки: локальные файлы, загруженные в проект (демо-контент). */
export const covers = {
  mountains: '/uploads/remote-5de93afb29936f48.jpg',
  ocean: '/uploads/remote-7212c26bc51771b7.jpg',
  forest: '/uploads/remote-f6b96fc6f999fe1d.jpg',
  portrait: '/uploads/remote-262781b73f72437d.jpg',
  city: '/uploads/remote-7ff9e6f1f73abaef.jpg',
  stage: '/uploads/remote-eb91740116499eb5.jpg',
  street: '/uploads/remote-0ff18c4eeb18e3f5.jpg',
}

export type NavItem = { to: string; label: string; icon: LucideIcon }

export const mainNav: NavItem[] = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/library', label: 'Библиотека', icon: Library },
  { to: '/albums', label: 'Альбомы', icon: Disc3 },
  { to: '/artists', label: 'Исполнители', icon: Users },
  { to: '/favorites', label: 'Избранное', icon: Heart },
  { to: '/history', label: 'История', icon: History },
  { to: '/playlists', label: 'Плейлисты', icon: ListMusic },
  { to: '/offline', label: 'Офлайн-загрузки', icon: Download },
]

export const secondaryNav: NavItem[] = [
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/about', label: 'О приложении', icon: Info },
]

export type Track = {
  title: string
  duration: string
  cover: string
}

export type Album = {
  id: string
  title: string
  artist: string
  year: string
  cover: string
  tracks: Track[]
}

const t = (title: string, duration: string, cover: string): Track => ({ title, duration, cover })

export const albums: Album[] = [
  {
    id: 'mountain-echoes',
    title: 'Mountain Echoes',
    artist: 'Ambient Flow',
    year: '2024',
    cover: covers.mountains,
    tracks: [
      t('Echoes of Silence', '4:12', covers.mountains),
      t('Mountain Dreams', '5:28', covers.mountains),
      t('Higher Ground', '3:45', covers.mountains),
      t('Lost in Nature', '6:20', covers.mountains),
      t('Peaceful Mind', '4:37', covers.mountains),
      t('Eternal Flow', '5:12', covers.mountains),
    ],
  },
  {
    id: 'midnight-dreams',
    title: 'Midnight Dreams',
    artist: 'Various Artists',
    year: '2024',
    cover: covers.forest,
    tracks: [
      t('Night Silence', '4:02', covers.forest),
      t('Deep Blue', '3:58', covers.forest),
      t('Slow Motion', '5:11', covers.forest),
      t('Midnight Dreams', '4:44', covers.forest),
      t('Afterglow', '3:36', covers.forest),
    ],
  },
  {
    id: 'neon-lights',
    title: 'Neon Lights',
    artist: 'The Horizon',
    year: '2023',
    cover: covers.street,
    tracks: [
      t('Neon Lights', '3:52', covers.street),
      t('City Rain', '4:18', covers.street),
      t('Late Drive', '3:41', covers.street),
      t('Signals', '4:05', covers.street),
    ],
  },
  {
    id: 'feel-the-vibe',
    title: 'Feel the Vibe',
    artist: 'Lo-Fi Dreams',
    year: '2024',
    cover: covers.portrait,
    tracks: [
      t('Feel the Vibe', '3:48', covers.portrait),
      t('Velvet Room', '4:20', covers.portrait),
      t('Soft Focus', '3:33', covers.portrait),
      t('Slow Sunday', '5:02', covers.portrait),
    ],
  },
  {
    id: 'ocean-breath',
    title: 'Ocean Breath',
    artist: 'Deep Sound',
    year: '2023',
    cover: covers.ocean,
    tracks: [
      t('Ocean Breath', '5:34', covers.ocean),
      t('Tide', '4:46', covers.ocean),
      t('Salt & Air', '6:11', covers.ocean),
      t('Underwater', '4:28', covers.ocean),
    ],
  },
  {
    id: 'city-after-rain',
    title: 'City After Rain',
    artist: 'The Horizon',
    year: '2024',
    cover: covers.city,
    tracks: [
      t('Rooftops', '3:49', covers.city),
      t('Glass Streets', '4:15', covers.city),
      t('Night Bus', '3:27', covers.city),
    ],
  },
  {
    id: 'silent-peaks',
    title: 'Silent Peaks',
    artist: 'Ambient Flow',
    year: '2022',
    cover: covers.mountains,
    tracks: [
      t('First Snow', '5:03', covers.mountains),
      t('Altitude', '4:39', covers.mountains),
      t('Cold Light', '6:02', covers.mountains),
    ],
  },
  {
    id: 'live-session',
    title: 'Live Session',
    artist: 'Various Artists',
    year: '2023',
    cover: covers.stage,
    tracks: [
      t('Intro', '2:14', covers.stage),
      t('Stage Lights', '4:57', covers.stage),
      t('Encore', '5:26', covers.stage),
    ],
  },
]

export type RecentlyPlayed = {
  title: string
  artist: string
  cover: string
  albumId: string
}

export const recentlyPlayed: RecentlyPlayed[] = [
  { title: 'Midnight Dreams', artist: 'Various Artists', cover: covers.forest, albumId: 'midnight-dreams' },
  { title: 'Neon Lights', artist: 'The Horizon', cover: covers.street, albumId: 'neon-lights' },
  { title: 'Mountain Echoes', artist: 'Ambient Flow', cover: covers.mountains, albumId: 'mountain-echoes' },
  { title: 'Feel the Vibe', artist: 'Lo-Fi Dreams', cover: covers.portrait, albumId: 'feel-the-vibe' },
  { title: 'Ocean Breath', artist: 'Deep Sound', cover: covers.ocean, albumId: 'ocean-breath' },
  { title: 'City After Rain', artist: 'The Horizon', cover: covers.city, albumId: 'city-after-rain' },
]

export type LibraryTile = {
  label: string
  count: string
  to: string
  icon: 'heart' | 'clock' | 'music' | 'download'
  color: string
  glow: string
}

export const libraryTiles: LibraryTile[] = [
  { label: 'Избранное', count: '128 треков', to: '/favorites', icon: 'heart', color: '#ec4899', glow: 'rgba(236,72,153,0.35)' },
  { label: 'История', count: '247 треков', to: '/history', icon: 'clock', color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' },
  { label: 'Плейлисты', count: '12 плейлистов', to: '/playlists', icon: 'music', color: '#4f7cff', glow: 'rgba(79,124,255,0.35)' },
  { label: 'Офлайн', count: '45 треков', to: '/offline', icon: 'download', color: '#34d399', glow: 'rgba(52,211,153,0.32)' },
]

export type Playlist = {
  id: string
  title: string
  count: string
  cover?: string
  icon?: 'star'
  gradient?: string
}

export const playlists: Playlist[] = [
  { id: 'favorites', title: 'Любимые треки', count: '128 треков', icon: 'star', gradient: 'linear-gradient(135deg, #6d28d9, #a855f7)' },
  { id: 'evening', title: 'Вечерний вайб', count: '87 треков', cover: covers.street },
  { id: 'workout', title: 'Тренировка', count: '64 трека', cover: covers.city },
  { id: 'work', title: 'Для работы', count: '102 трека', cover: covers.stage },
  { id: 'travel', title: 'Путешествия', count: '76 треков', cover: covers.mountains },
  { id: 'relax', title: 'Релакс', count: '93 трека', cover: covers.ocean },
]

export type Artist = {
  id: string
  name: string
  cover: string
}

export const artists: Artist[] = [
  { id: 'ambient-flow', name: 'Ambient Flow', cover: covers.mountains },
  { id: 'the-horizon', name: 'The Horizon', cover: covers.street },
  { id: 'lo-fi-dreams', name: 'Lo-Fi Dreams', cover: covers.portrait },
  { id: 'deep-sound', name: 'Deep Sound', cover: covers.ocean },
  { id: 'various', name: 'Various Artists', cover: covers.forest },
]

export type HeroSlide = {
  id: string
  tag: string
  title: string
  subtitle: string
  cover: string
}

export const heroSlides: HeroSlide[] = [
  {
    id: 'resonance',
    tag: 'Рекомендуем',
    title: 'Resonance',
    subtitle: 'Открой новую волну музыки',
    cover: covers.stage,
  },
  {
    id: 'mountain-echoes',
    tag: 'Новый альбом',
    title: 'Mountain Echoes',
    subtitle: 'Ambient Flow',
    cover: covers.mountains,
  },
  {
    id: 'feel-the-vibe',
    tag: 'Сборник',
    title: 'Feel the Vibe',
    subtitle: 'Lo-Fi Dreams',
    cover: covers.portrait,
  },
  {
    id: 'ocean-breath',
    tag: 'Подборка',
    title: 'Ocean Breath',
    subtitle: 'Deep Sound',
    cover: covers.ocean,
  },
]

export const libraryFilters = ['Все', 'Треки', 'Альбомы', 'Исполнители', 'Плейлисты'] as const

export const nowPlaying = {
  title: 'Midnight Dreams',
  artist: 'Various Artists',
  album: 'Midnight Dreams',
  cover: covers.forest,
  duration: '3:48',
  elapsed: '1:24',
}

export const queue: Track[] = [
  t('Mountain Dreams', '5:28', covers.mountains),
  t('Neon Lights', '3:52', covers.street),
  t('Feel the Vibe', '3:48', covers.portrait),
  t('Ocean Breath', '5:34', covers.ocean),
]
