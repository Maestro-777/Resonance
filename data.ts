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
