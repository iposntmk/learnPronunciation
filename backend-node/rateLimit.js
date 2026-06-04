const buckets = new Map()
const MAX_BUCKETS = 500

function pruneExpired(now) {
  if (buckets.size <= MAX_BUCKETS) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function checkRateLimit({ key, limit, windowMs }) {
  const now = Date.now()
  pruneExpired(now)

  const bucketKey = String(key || 'global')
  const current = buckets.get(bucketKey)
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 }
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: Math.max(0, Math.ceil((current.resetAt - now) / 1000)),
  }
}
