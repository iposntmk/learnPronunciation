import { createHash, randomUUID } from 'node:crypto'
import { statusPayload } from './config.js'
import { json, parseMultipart, readBody } from './http.js'

const CORE_TYPE = 'word.eval.promax'
const SPEECHSUPER_URL = `https://api.speechsuper.com/${CORE_TYPE}`

function sha1(value) {
  return createHash('sha1').update(value).digest('hex')
}

function audioType(filename) {
  return filename.split('.').pop()?.toLowerCase() || 'wav'
}

function buildSpeechSuperParams({ appKey, secretKey, userId, text, type }) {
  const timestamp = Date.now().toString()
  return {
    connect: {
      cmd: 'connect',
      param: {
        sdk: { version: 16777472, source: 9, protocol: 2 },
        app: { applicationId: appKey, sig: sha1(appKey + timestamp + secretKey), timestamp },
      },
    },
    start: {
      cmd: 'start',
      param: {
        app: { userId, applicationId: appKey, timestamp, sig: sha1(appKey + timestamp + userId + secretKey) },
        audio: { audioType: type, channel: 1, sampleBytes: 2, sampleRate: '16000' },
        request: { coreType: CORE_TYPE, refText: text, tokenId: randomUUID() },
      },
    },
  }
}

function getCi(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined
  const found = Object.keys(obj).find(item => item.toLowerCase() === key.toLowerCase())
  return found ? obj[found] : undefined
}

function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach(item => walk(item, visit))
  if (!node || typeof node !== 'object') return
  visit(node)
  Object.values(node).forEach(value => walk(value, visit))
}

function firstValue(obj, keys) {
  for (const key of keys) {
    const value = getCi(obj, key)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function scoreValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.round(Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)))
}

function normalizeSyllable(node, index) {
  const text = firstValue(node, ['syllable', 'text', 'content', 'label', 'phone', 'letters'])
  const score = scoreValue(firstValue(node, ['stressScore', 'stress_score', 'score', 'qualityScore']))
  const expectedStress = firstValue(node, ['expectedStress', 'stressLevel', 'stress_level', 'stressType', 'standardStress'])
  const actualStress = firstValue(node, ['actualStress', 'detectedStress', 'stress', 'isStress', 'stressStatus'])
  const errorType = firstValue(node, ['errorType', 'stressError', 'stress_error', 'status'])
  if (text == null && score == null && expectedStress == null && actualStress == null && errorType == null) return null
  return { index, text: String(text || ''), score, expectedStress, actualStress, errorType: errorType == null ? null : String(errorType) }
}

function normalizeSpeechSuper(raw, referenceText) {
  const syllables = []
  let stressScore = null
  walk(raw, node => {
    Object.entries(node).forEach(([key, value]) => {
      if (!key.toLowerCase().includes('syll')) return
      ;(Array.isArray(value) ? value : [value]).forEach(item => {
        const syllable = normalizeSyllable(item, syllables.length)
        if (syllable) syllables.push(syllable)
      })
    })
    if (stressScore == null) stressScore = scoreValue(firstValue(node, ['stressScore', 'stress_score', 'wordStressScore']))
  })
  const issues = syllables.filter(item => {
    const error = String(item.errorType || '').toLowerCase()
    const hasExpected = item.expectedStress !== null && item.expectedStress !== undefined && item.expectedStress !== ''
    const hasActual = item.actualStress !== null && item.actualStress !== undefined && item.actualStress !== ''
    const mismatch = hasExpected && hasActual && String(item.expectedStress) !== String(item.actualStress)
    return error.includes('stress') && !error.includes('correct') || item.score != null && item.score < 65 || mismatch
  }).map(item => ({ type: 'stress', word: referenceText, syllableIndex: item.index, expectedStress: item.expectedStress, actualStress: item.actualStress, score: item.score }))
  return { status: 'success', provider: 'speechsuper', words: [], syllables, issues, stressScore, raw }
}

export async function handleSpeechSuperPronunciation(req, res) {
  const envStatus = statusPayload()
  if (!envStatus.speechSuperConfigured) return json(res, 500, { detail: 'SpeechSuper configuration is missing.' })
  const { fields, files } = parseMultipart(req, await readBody(req))
  const text = String(fields.text || '').trim()
  const audio = files.audio
  if (!text) return json(res, 400, { detail: 'Missing text.' })
  if (!audio?.content?.length) return json(res, 400, { detail: 'Missing audio.' })

  const appKey = process.env.SPEECHSUPER_APP_KEY.trim()
  const secretKey = process.env.SPEECHSUPER_SECRET_KEY.trim()
  const userId = String(fields.userId || envStatus.userId || 'guest').trim() || 'guest'
  const params = buildSpeechSuperParams({ appKey, secretKey, userId, text, type: audioType(audio.filename) })
  const form = new FormData()
  form.append('text', JSON.stringify(params))
  form.append('audio', new Blob([audio.content], { type: audio.type }), audio.filename)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(SPEECHSUPER_URL, { method: 'POST', headers: { 'Request-Index': '0' }, body: form, signal: controller.signal })
    const rawText = await response.text()
    if (!response.ok) return json(res, 502, { detail: `SpeechSuper API error ${response.status}: ${rawText.slice(0, 200)}` })
    // DEBUG: dump full SpeechSuper response to inspect real field structure for per-syllable parsing
    console.log(`[SpeechSuper] raw response for "${text}":`, rawText)
    return json(res, 200, normalizeSpeechSuper(JSON.parse(rawText), text))
  } catch (err) {
    const message = err.name === 'AbortError' ? 'SpeechSuper request timed out.' : err.message
    return json(res, 502, { detail: message })
  } finally {
    clearTimeout(timer)
  }
}
