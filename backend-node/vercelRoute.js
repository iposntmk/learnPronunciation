import { loadDefaultEnv } from './config.js'
import { json, send } from './http.js'

loadDefaultEnv()

export function handleCors(req, res, methods = 'GET,POST,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    send(res, 204, '')
    return true
  }
  return false
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true
  json(res, 405, { detail: `Method ${req.method} not allowed.` })
  return false
}
