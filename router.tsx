import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import {
  About,
  AlbumDetail,
  Albums,
  Artists,
  Favorites,
  History,
  Home,
  Library,
  NotFound,
  Offline,
  Player,
  Playlists,
  Settings,
} from './pages/Views'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'library', element: <Library /> },
      { path: 'albums', element: <Albums /> },
      { path: 'albums/:id', element: <AlbumDetail /> },
      { path: 'artists', element: <Artists /> },
      { path: 'playlists', element: <Playlists /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'history', element: <History /> },
      { path: 'offline', element: <Offline /> },
      { path: 'player', element: <Player /> },
      { path: 'settings', element: <Settings /> },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
