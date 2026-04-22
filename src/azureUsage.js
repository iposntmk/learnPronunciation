// Tracks Azure Speech monthly usage in localStorage (5h free tier = 18000s/month)

const KEY = 'az_usage'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function recordAzureUsage(seconds) {
  const month = currentMonth()
  let data = {}
  try { data = JSON.parse(localStorage.getItem(KEY) || '{}') } catch {}
  const prev = data.month === month ? (data.seconds || 0) : 0
  localStorage.setItem(KEY, JSON.stringify({ month, seconds: prev + seconds }))
}

export function getAzureUsageSeconds() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (data.month !== currentMonth()) return 0
    return data.seconds || 0
  } catch { return 0 }
}

export function formatUsageDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

// Returns { used: hours (float), total: 5, pct: 0-100, seconds, usedLabel }
export function getAzureUsageSummary() {
  const seconds = getAzureUsageSeconds()
  const used = seconds / 3600
  return {
    used,
    total: 5,
    pct: Math.min(100, (used / 5) * 100),
    seconds,
    usedLabel: formatUsageDuration(seconds),
  }
}
