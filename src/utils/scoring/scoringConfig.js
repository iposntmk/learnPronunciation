const TTL_MS = 30_000
let cachedStatus = null
let cachedAt = 0

function statusUrl() {
  const speechSuperProxy = import.meta.env?.VITE_SPEECHSUPER_PROXY_URL || ''
  if (speechSuperProxy) return String(speechSuperProxy).replace(/\/pronunciation\/?$/i, '/status')
  const raw = import.meta.env?.VITE_AZURE_PROXY_URL || ''
  const base = String(raw).trim().replace(/\/azure\/(?:word|sentence|tts|status)\/?$/i, '').replace(/\/$/, '')
  return base ? `${base}/speechsuper/status` : ''
}

function normalizeMode(value) {
  return ['azure', 'speechsuper', 'both'].includes(value) ? value : 'azure'
}

export async function getSpeechSuperStatus() {
  if (cachedStatus && Date.now() - cachedAt < TTL_MS) return cachedStatus
  const url = statusUrl()
  if (!url) return { scoringMode: 'azure', expiresAt: null }
  try {
    const data = await (await fetch(url)).json()
    cachedStatus = {
      ...data,
      scoringMode: normalizeMode(data?.scoringMode),
      expiresAt: data?.expiresAt || null,
    }
    cachedAt = Date.now()
    return cachedStatus
  } catch {
    return { scoringMode: 'azure', expiresAt: null }
  }
}

export async function getConfiguredMode() {
  const status = await getSpeechSuperStatus()
  return normalizeMode(status.scoringMode)
}

export function speechSuperExpiryDaysLeft(expiresAt) {
  if (!expiresAt) return null
  const time = new Date(expiresAt).getTime()
  if (Number.isNaN(time)) return null
  return Math.ceil((time - Date.now()) / 86_400_000)
}

export function isSpeechSuperExpired(status) {
  if (!status?.expiresAt) return false
  const time = new Date(status.expiresAt).getTime()
  return Number.isFinite(time) && Date.now() >= time
}

export async function getScoringMode() {
  const status = await getSpeechSuperStatus()
  const mode = normalizeMode(status.scoringMode)
  if (mode !== 'azure' && status.configured === false) return 'azure'
  return mode !== 'azure' && isSpeechSuperExpired(status) ? 'azure' : mode
}
