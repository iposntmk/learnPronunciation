import { requireAdmin } from '../../backend-node/adminAuth.js'
import { testSpeechSuperCredential } from '../../backend-node/speechSuperCredentials.js'
import { json, readBody } from '../../backend-node/http.js'
import { checkRateLimit } from '../../backend-node/rateLimit.js'
import { handleCors, requireMethod } from '../../backend-node/vercelRoute.js'

async function readJson(req) {
  const body = await readBody(req)
  return JSON.parse(body.toString('utf8') || '{}')
}

function rateLimited(res, userId) {
  const result = checkRateLimit({
    key: `speechsuper:test:${userId}`,
    limit: 5,
    windowMs: 60_000,
  })
  if (result.ok) return false
  res.setHeader('Retry-After', String(result.retryAfterSeconds))
  json(res, 429, { detail: 'Too many SpeechSuper tests. Try again later.' })
  return true
}

export default async function handler(req, res) {
  if (handleCors(req, res, 'POST,OPTIONS')) return
  if (!requireMethod(req, res, 'POST')) return

  try {
    const admin = await requireAdmin(req)
    if (admin.error) return json(res, admin.error.status, { detail: admin.error.detail })
    if (rateLimited(res, admin.user.id)) return

    const payload = await readJson(req)
    return json(res, 200, await testSpeechSuperCredential(payload, admin.user.id))
  } catch (err) {
    const status = err instanceof SyntaxError ? 400 : 500
    return json(res, status, { detail: err.message })
  }
}
