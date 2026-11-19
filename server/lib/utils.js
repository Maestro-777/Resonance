import path from 'node:path'
import net from 'node:net'


export function isPublicIpAddress(address) {
  const version = netVersion(address)
  if (version === 4) {
    const octets = address.split('.').map(Number)
    const [a, b] = octets
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && (b === 0 || b === 168)) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a === 192 && b === 88 && octets[2] === 99) return false
    return true
  }
  if (version === 6) {
    const value = address.toLowerCase()
    if (value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('ff')) return false
    if (value.startsWith('::ffff:')) return isPublicIpAddress(value.slice(7))
    return /^[23][0-9a-f]{3}:/i.test(value)
  }
  return false
}
function netVersion(address) {
  const value = String(address).replace(/^\[|\]$/g, '')
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    const parts = value.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255) ? 4 : 0
  }
  return value.includes(':') ? 6 : 0
}

export function resolveServerHost(requestedHost) {
  return requestedHost === '127.0.0.1' ? requestedHost : '127.0.0.1'
}

export function resolveSafePath(root, relativePath) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, relativePath)
  const relative = path.relative(resolvedRoot, resolvedPath)
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Invalid path outside music root')
  }
  return resolvedPath
}

export function parseByteRange(header, size) {
  if (typeof header !== 'string' || !Number.isSafeInteger(size) || size <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return null
  let start
  let end
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null
    end = Math.min(end, size - 1)
  }
  if (start < 0 || start >= size || start > end) return null
  return { start, end }
}

export function mergeSyncStates(previous = {}, incoming = {}) {
  const left = sanitizeSyncState(previous)
  const right = sanitizeSyncState(incoming)
  const has = key => Object.prototype.hasOwnProperty.call(incoming || {}, key)
  const mergeStrings = (a, b, limit) => [...new Set([...a, ...b])].slice(-limit)
  return {
    version: 1,
    // Collection arrays are snapshots: replacements, deletions and user-defined ordering
    // must survive sync. History remains append/merge oriented across devices.
    favorites: has('favorites') ? right.favorites : left.favorites,
    playlists: has('playlists') ? right.playlists : left.playlists,
    history: has('history') ? mergeStrings(right.history, left.history, 500) : left.history,
    queue: has('queue') ? right.queue : left.queue,
    playback: (() => { const a = left.playback, b = right.playback; if (!a) return b; if (!b) return a; return Date.parse(b.updatedAt || '') >= Date.parse(a.updatedAt || '') ? b : a })(),
    preferences: right.preferences || left.preferences,
    appearance: right.appearance || left.appearance,
    equalizer: right.equalizer || left.equalizer,
    updatedAt: new Date().toISOString(),
  }
}

export function sanitizeSyncState(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const strings = (items, limit) => Array.isArray(items)
    ? [...new Set(items.filter(item => typeof item === 'string' && item.length <= 256))].slice(0, limit)
    : []
  const playlists = Array.isArray(input.playlists)
    ? input.playlists.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.trackIds))
      .slice(0, 500)
      .map(item => ({
        id: item.id.slice(0, 128),
        name: item.name.trim().slice(0, 120),
        trackIds: strings(item.trackIds, 5000),
        ...(typeof item.description === 'string' ? { description: item.description.slice(0, 500) } : {}),
        ...(typeof item.cover === 'string' && item.cover.length <= 8 * 1024 * 1024 && (new RegExp('^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$', 'i').test(item.cover) || new RegExp('^/api/artwork/[A-Za-z0-9_-]{1,128}$').test(item.cover)) ? { cover: item.cover } : {}),
      }))
      .filter(item => item.name.length > 0)
    : []
  const sourcePlayback = input.playback && typeof input.playback === 'object' && !Array.isArray(input.playback) ? input.playback : null
  const playback = sourcePlayback && typeof sourcePlayback.trackId === 'string' && sourcePlayback.trackId.length <= 256 && Number.isFinite(sourcePlayback.position) && sourcePlayback.position >= 0
    ? { trackId: sourcePlayback.trackId, position: Math.min(sourcePlayback.position, 86400), updatedAt: typeof sourcePlayback.updatedAt === 'string' ? sourcePlayback.updatedAt : null }
    : null
  const sourcePrefs = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences) ? input.preferences : {}
  const preferences = {}
  if (['dark', 'light', 'system'].includes(sourcePrefs.theme)) preferences.theme = sourcePrefs.theme
  if (['violet', 'blue', 'mint', 'rose', 'amber'].includes(sourcePrefs.accent)) preferences.accent = sourcePrefs.accent
  for (const key of ['compact', 'sidebar', 'visualizer', 'floatingPlayer']) if (typeof sourcePrefs[key] === 'boolean') preferences[key] = sourcePrefs[key]
  if (['solid', 'gradient', 'glass'].includes(sourcePrefs.background)) preferences.background = sourcePrefs.background
  for (const [key, min, max] of [['radius', 4, 28], ['fontScale', 85, 120], ['blur', 0, 30], ['crossfadeSeconds', 0, 8]]) {
    const value = Number(sourcePrefs[key])
    if (Number.isFinite(value)) preferences[key] = Math.min(max, Math.max(min, value))
  }
  const sourceAppearance = input.appearance && typeof input.appearance === 'object' && !Array.isArray(input.appearance) ? input.appearance : {}
  const appearance = {}
  if (['night', 'amethyst', 'graphite', 'oled'].includes(sourceAppearance.theme)) appearance.theme = sourceAppearance.theme
  if (typeof sourceAppearance.accent === 'string' && /^#[0-9a-f]{6}$/i.test(sourceAppearance.accent)) appearance.accent = sourceAppearance.accent.toLowerCase()
  if (['comfortable', 'compact'].includes(sourceAppearance.density)) appearance.density = sourceAppearance.density
  for (const key of ['glow', 'animations', 'labels']) if (typeof sourceAppearance[key] === 'boolean') appearance[key] = sourceAppearance[key]
  for (const [key, min, max] of [['radius', 4, 28], ['blur', 0, 30], ['scale', 0.85, 1.2], ['cols', 2, 8]]) {
    const value = Number(sourceAppearance[key])
    if (Number.isFinite(value)) appearance[key] = Math.min(max, Math.max(min, value))
  }
  const sourceEq = input.equalizer && typeof input.equalizer === 'object' && !Array.isArray(input.equalizer) ? input.equalizer : {}
  const sourceBands = sourceEq.eq && typeof sourceEq.eq === 'object' ? sourceEq.eq : {}
  const eq = {}
  const bandKeys = ['32', '64', '125', '250', '500', '1000', '2000', '4000', '8000', '16000']
  const clampBand = value => Number.isFinite(value) ? Math.min(12, Math.max(-12, value)) : 0
  if (bandKeys.some(key => typeof sourceBands[key] === 'number')) {
    for (const key of bandKeys) eq[key] = clampBand(sourceBands[key])
  } else {
    const bass = clampBand(sourceBands.bass), mid = clampBand(sourceBands.mid), treble = clampBand(sourceBands.treble)
    Object.assign(eq, { '32': bass, '64': bass, '125': bass, '250': mid, '500': mid, '1000': mid, '2000': mid, '4000': treble, '8000': treble, '16000': treble })
  }
  const equalizer = Object.keys(eq).length ? { eq, eqPreset: typeof sourceEq.eqPreset === 'string' ? sourceEq.eqPreset.slice(0, 40) : 'Пользовательский' } : null
  return {
    version: 1,
    favorites: strings(input.favorites, 10000),
    playlists,
    history: strings(input.history, 500),
    queue: strings(input.queue, 5000),
    playback,
    preferences: Object.keys(preferences).length ? preferences : null,
    appearance: Object.keys(appearance).length ? appearance : null,
    equalizer,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
  }
}

const AUDIO_UPLOAD_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.wma', '.aiff'])
export function sanitizeUploadFilename(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Empty upload filename')
  const leaf = input.replace(/\\/g, '/').split('/').pop().normalize('NFKC').trim()
  const extension = path.extname(leaf).toLowerCase()
  if (!AUDIO_UPLOAD_EXTENSIONS.has(extension)) throw new Error('Unsupported audio file extension')
  const rawStem = leaf.slice(0, leaf.length - path.extname(leaf).length)
  const stem = rawStem.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').replace(/[. ]+$/g, '').trim().slice(0, 120) || 'audio'
  return stem + extension
}

export function parseReplayGainDb(value) {
  if (value === null || value === undefined) return null
  const match = String(value).match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? Math.max(-12, Math.min(6, parsed)) : null
}
