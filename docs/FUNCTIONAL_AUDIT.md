# Functional parity audit: Resonance vs pwa-player-music

Audit basis: current `main` of `Maestro-777/Resonance` and current `main` of `Maestro-777/pwa-player-music`. The older project's documented feature list in its README was checked against the current Resonance UI, player context, offline module and server routes. This is a source-code audit, not a claim that every device/browser combination has been manually exercised.

## Parity matrix

| Capability in the older player | Resonance status | Notes |
|---|---|---|
| Scan a configured music folder and read audio metadata | Implemented | Server scanner and explicit rescan action are present. |
| Browse library, albums and artists | Implemented | Views are derived from the real indexed track list. |
| Search and sort library | Implemented | Search covers title, artist, album and genre; library sort options are present. |
| Stream audio with HTTP Range support | Implemented | Server stream route handles byte ranges. |
| Play, pause, seek, volume, previous/next | Implemented | Shared PlayerContext drives the persistent player. |
| Queue add, remove and clear | Implemented | Queue is persisted locally and synchronized. |
| Queue reorder | Added in this audit | Move-up / move-down controls now change the persisted queue order. |
| Play a whole playlist in order | Added in this audit | Starting a playlist now starts its first track and queues the remaining tracks in playlist order. |
| Favorites, playlists and listening history | Implemented | Stored locally and included in server sync. |
| Playlist cover, name, description, membership editing and track ordering | Implemented | User-provided playlist cover currently lives in browser-side playlist data. |
| Shuffle and repeat modes | Implemented | Off, repeat-all and repeat-one behavior. |
| Sleep timer | Implemented | Timer stops playback after a selected interval. |
| 10-band Web Audio equalizer | Implemented | Includes built-in presets and custom band adjustment. |
| ReplayGain | Implemented | Track ReplayGain tags are read by the scanner and applied during playback. |
| Crossfade and gapless transition | Implemented | Dual audio-deck playback; crossfade is configurable. |
| Lyrics from adjacent .lrc / .txt files | Implemented | Timed LRC lines are highlighted in the player. |
| Edit audio metadata and embedded artwork | Implemented | Server writes supported tags and creates a pre-edit backup. |
| Browse and restore metadata backups | Implemented | Backups can be listed and restored from Settings. |
| Upload music from a browser | Implemented | Upload endpoint places files in the server's upload folder and rescans. |
| Offline track downloads | Implemented | Per-device IndexedDB storage; offline playback uses saved blobs. |
| Sync favorites, playlists, history, queue, EQ and playback preferences | Implemented | Private home-server JSON sync; not a multi-user cloud service. |
| Export and import user data | Implemented | JSON export/import does not include audio files. |
| PWA install and app shell | Implemented | Install prompt where supported; iOS uses browser's Add to Home Screen flow. |
| Media Session lock-screen controls | Implemented | Browser/OS support determines actual behavior. |

## Known limitations / next work

1. **Album artwork overrides and playlist artwork are not a server-side media library.** Custom covers are currently stored with browser-side data. They do not automatically appear on another device unless the relevant collection data is transferred; large data URLs are not a good long-term sync format. Move artwork to managed server files with stable IDs and include references in sync.
2. **Offline audio is per device.** Each phone/computer must download tracks independently. The PWA shell cache does not cache the entire music library automatically.
3. **History and queue management need richer controls.** Queue ordering is now available; history clearing, queue persistence edge cases and better mobile controls should be tested and refined.
4. **Playlist bulk operations remain limited.** Track order can now be changed with move-up / move-down controls; drag-and-drop and bulk selection remain follow-up work.
5. **Sync is a personal single-server snapshot/merge.** It is not account-based cloud sync and does not provide full conflict resolution for simultaneous edits. Large libraries or multiple independent users need a different storage model.
6. **Metadata writing depends on format.** MP3 uses ID3 support; FLAC/M4A/OGG/OPUS require FFmpeg. WAV/AAC/WMA/AIFF can be read/played but are not all writable by the metadata editor.
7. **Manual device testing remains necessary.** PWA install, background audio, Media Session, offline quota behavior, and crossfade quality depend on browser and operating system.

## Changes in this audit branch

- Queue supports moving any queued track up or down; the order continues to use the existing local persistence and sync path.
- The playlist Play action starts the full playlist in its displayed order rather than only starting its first track.
- Playlist tracks can be moved up or down; the order is part of the existing playlist data and is included in sync/export.

## Verification

Run the repository CI workflow for frontend production build, server syntax/tests and Windows installation/build checks. Device-level playback and PWA behavior require real-device testing.
