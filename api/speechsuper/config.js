import { requireAdmin } from '../../backend-node/adminAuth.js'
import { getSpeechSuperCredentialStatus, updateSpeechSuperCredential } from '../../backend-node/speechSuperCredentials.js'
import { json, readBody } from '../../backend-node/http.js'
import { checkRateLimit } from '../../backend-node/rateLimit.js'
import { handleCors } from '../../backend-node/vercelRoute.js'

async function readJson(req) {
  const body = await readBody(req)
  return JSON.parse(body.toString('utf8') || '{}')
}

function rateLimited(req, res, userId) {
  const result = checkRateLimit({
    key: `speechsuper:config:${req.method}:${userId}`,
    limit: req.method === 'POST' ? 8 : 60,
    windowMs: 60_000,
  })
  if (result.ok) return false
  res.setHeader('Retry-After', String(result.retryAfterSeconds))
  json(res, 429, { detail: 'Too many admin requests. Try again later.' })
  return true
}

export default async function handler(req, res) {
  if (handleCors(req, res, 'GET,POST,OPTIONS')) return
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { detail: `Method ${req.method} not allowed.` })

  try {
    const admin = await requireAdmin(req)
    if (admin.error) return json(res, admin.error.status, { detail: admin.error.detail })
    if (rateLimited(req, res, admin.user.id)) return

    if (req.method === 'GET') {
      return json(res, 200, await getSpeechSuperCredentialStatus({ includeHistory: true }))
    }

    const payload = await readJson(req)
    const status = await updateSpeechSuperCredential({
      appKey: payload.appKey,
      secretKey: payload.secretKey,
      userId: payload.userId,
      scoringMode: payload.scoringMode,
      expiresAt: payload.expiresAt,
      updatedBy: admin.user.id,
      includeHistory: true,
    })
    return json(res, 200, status)
  } catch (err) {
    const status = err instanceof SyntaxError ? 400 : 500
    return json(res, status, { detail: err.message })
  }
}
