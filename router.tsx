import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import {
  About,
  AlbumDetail,
  Albums,
  Artists,
  ArtistDetail,
  Favorites,
  History,
  Home,
  Library,
  NotFound,
  Offline,
  Player,\n  LyricsPage,
  Playlists,
  Settings,
  TrackMetadataEditor,
} from './pages/Views'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'library', element: <Library /> },
      { path: 'tracks/:id/edit', element: <TrackMetadataEditor /> },
      { path: 'albums', element: <Albums /> },
      { path: 'albums/:id', element: <AlbumDetail /> },
      { path: 'artists', element: <Artists /> },
      { path: 'artists/:id', element: <ArtistDetail /> },
      { path: 'playlists', element: <Playlists /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'history', element: <History /> },
      { path: 'offline', element: <Offline /> },
      { path: 'player', element: <Player /> },\n      { path: 'lyrics', element: <LyricsPage /> },\n      { path: 'lyrics/:id', element: <LyricsPage /> },
      { path: 'settings', element: <Settings /> },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
