import { requireAdmin } from '../../backend-node/adminAuth.js'
import { getSpeechSuperCredentialStatus, updateSpeechSuperCredential } from '../../backend-node/speechSuperCredentials.js'
import { json, readBody } from '../../backend-node/http.js'
import { handleCors } from '../../backend-node/vercelRoute.js'

async function readJson(req) {
  const body = await readBody(req)
  return JSON.parse(body.toString('utf8') || '{}')
}

export default async function handler(req, res) {
  if (handleCors(req, res, 'GET,POST,OPTIONS')) return
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { detail: `Method ${req.method} not allowed.` })

  try {
    const admin = await requireAdmin(req)
    if (admin.error) return json(res, admin.error.status, { detail: admin.error.detail })

    if (req.method === 'GET') return json(res, 200, await getSpeechSuperCredentialStatus())

    const payload = await readJson(req)
    const status = await updateSpeechSuperCredential({
      appKey: payload.appKey,
      secretKey: payload.secretKey,
      userId: payload.userId,
      scoringMode: payload.scoringMode,
      expiresAt: payload.expiresAt,
      updatedBy: admin.user.id,
    })
    return json(res, 200, status)
  } catch (err) {
    const status = err instanceof SyntaxError ? 400 : 500
    return json(res, status, { detail: err.message })
  }
}
