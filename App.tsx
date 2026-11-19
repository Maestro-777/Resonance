import AppShell from '@/components/Shell'
import { AppearanceProvider } from '@/theme'

export default function App() {
  return (
    <AppearanceProvider>
      <AppShell />
    </AppearanceProvider>
  )
}
