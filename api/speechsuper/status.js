import { statusPayloadAsync } from '../../backend-node/config.js'
import { json } from '../../backend-node/http.js'
import { handleCors, requireMethod } from '../../backend-node/vercelRoute.js'

export default async function handler(req, res) {
  if (handleCors(req, res, 'GET,OPTIONS')) return
  if (!requireMethod(req, res, 'GET')) return
  return json(res, 200, await statusPayloadAsync())
}
