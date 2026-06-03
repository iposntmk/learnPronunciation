// Đọc chế độ chấm từ backend-node (/speechsuper/status). Cache TTL ngắn để đổi cấu hình
// trên backend phản ánh sang frontend mà không phải reload. Lỗi/không cấu hình → 'azure'.
const TTL_MS = 30_000
let cachedRaw = null
let cachedAt = 0

// SpeechSuper dùng thử 15 ngày kể từ 02/06/2026 → hết hạn 17/06/2026.
// Hết hạn thì mọi chế độ tự hạ về 'azure'.
export const SPEECHSUPER_TRIAL_END = new Date('2026-06-17T00:00:00')

export function speechSuperTrialDaysLeft() {
  return Math.ceil((SPEECHSUPER_TRIAL_END.getTime() - Date.now()) / 86_400_000)
}

export function isSpeechSuperExpired() {
  return Date.now() >= SPEECHSUPER_TRIAL_END.getTime()
}

function statusUrl() {
  const raw = import.meta.env?.VITE_AZURE_PROXY_URL || ''
  const base = raw.trim().replace(/\/azure\/(?:word|sentence|tts|status)\/?$/i, '').replace(/\/$/, '')
  return base ? `${base}/speechsuper/status` : ''
}

// Chế độ user đã cấu hình trên backend (chưa hạ theo hạn dùng thử).
export async function getConfiguredMode() {
  if (cachedRaw && Date.now() - cachedAt < TTL_MS) return cachedRaw
  const url = statusUrl()
  if (!url) return 'azure'
  try {
    const data = await (await fetch(url)).json()
    cachedRaw = ['azure', 'speechsuper', 'both'].includes(data?.scoringMode) ? data.scoringMode : 'azure'
    cachedAt = Date.now()
    return cachedRaw
  } catch {
    return 'azure'
  }
}

// Chế độ thực thi: nếu SpeechSuper hết hạn dùng thử → toàn bộ về 'azure'.
export async function getScoringMode() {
  const mode = await getConfiguredMode()
  return mode !== 'azure' && isSpeechSuperExpired() ? 'azure' : mode
}
