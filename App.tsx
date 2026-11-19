import AppShell from '@/components/Shell'
import { PlayerProvider } from '@/player/PlayerContext'
import { AppearanceProvider } from '@/theme'

export default function App() {
  return (
    <AppearanceProvider>
      <PlayerProvider>
        <AppShell />
      </PlayerProvider>
    </AppearanceProvider>
  )
}
