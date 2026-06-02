import { handleElevenLabsTts } from '../../backend-node/elevenLabs.js'
import { handleCors, requireMethod } from '../../backend-node/vercelRoute.js'

export default async function handler(req, res) {
  if (handleCors(req, res, 'POST,OPTIONS')) return
  if (!requireMethod(req, res, 'POST')) return
  return handleElevenLabsTts(req, res)
}
