import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import http from 'node:http'
import { handleAzureSentence, handleAzureTts, handleAzureWord } from './azure.js'
import { loadDefaultEnv, statusPayloadAsync, updateConfig } from './config.js'
import { handleElevenLabsTts } from './elevenLabs.js'
import { json, readBody, send } from './http.js'
import { handleSpeechSuperPronunciation } from './speechSuper.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

loadDefaultEnv()

const PORT = Number(process.env.PORT || 8000)
const HOST = process.env.HOST || '0.0.0.0'

async function saveConfig(req, res) {
  try {
    const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    return json(res, 200, updateConfig(payload))
  } catch (err) {
    return json(res, 400, { detail: err.message })
  }
}

function lanUrls(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal)
    .map(item => `http://${item.address}:${port}/speechsuper`)
}

http.createServer(async (req, res) => {
  const path = req.url.split('?')[0]
  if (req.method === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' })
  if (req.method === 'GET' && path === '/') return send(res, 307, '', { Location: '/speechsuper' })
  if (req.method === 'GET' && path === '/speechsuper/status') return json(res, 200, await statusPayloadAsync())
  if (req.method === 'POST' && path === '/speechsuper/config') return saveConfig(req, res)
  if (req.method === 'GET' && path === '/speechsuper') return send(res, 200, readFileSync(join(__dirname, 'ui.html')), { 'Content-Type': 'text/html; charset=utf-8' })
  if (req.method === 'POST' && path === '/speechsuper/pronunciation') return handleSpeechSuperPronunciation(req, res)
  if (req.method === 'POST' && path === '/azure/word') return handleAzureWord(req, res)
  if (req.method === 'POST' && path === '/azure/sentence') return handleAzureSentence(req, res)
  if (req.method === 'POST' && path === '/azure/tts') return handleAzureTts(req, res)
  if (req.method === 'POST' && path === '/elevenlabs/tts') return handleElevenLabsTts(req, res)
  return json(res, 404, { detail: 'Not found.' })
}).listen(PORT, HOST, () => {
  console.log(`SpeechSuper Node backend: http://localhost:${PORT}/speechsuper`)
  lanUrls(PORT).forEach(url => console.log(`LAN: ${url}`))
})
