import { json, parseMultipart, readBody, send } from './http.js'
import { normalizeSentenceResult, normalizeWordResult } from './azureResult.js'

const STT_TIMEOUT_MS = 18000
const TTS_TIMEOUT_MS = 12000

function clean(value) {
  return String(value || '').trim().replace(/[\r\n]/g, '')
}

function azureConfig() {
  const key = clean(process.env.AZURE_KEY)
  const region = clean(process.env.AZURE_REGION || 'southeastasia')
  if (!key) throw new Error('Azure key chưa được cấu hình trong backend.')
  if (!region) throw new Error('Azure region chưa được cấu hình trong backend.')
  return { key, region }
}

async function withTimeout(promiseFactory, timeoutMs, label) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await promiseFactory(controller.signal)
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`${label} timed out.`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function callPronunciationAzure({ audio, referenceText, language, prosody }) {
  const { key, region } = azureConfig()
  const cfg = {
    referenceText,
    gradingSystem: 'HundredMark',
    granularity: 'Phoneme',
    dimension: 'Comprehensive',
    enableMiscue: true,
    enableProsodyAssessment: Boolean(prosody),
    phonemeAlphabet: 'IPA',
  }
  const header = Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64')
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`

  return withTimeout(async signal => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav',
        'Pronunciation-Assessment': header,
        Accept: 'application/json',
      },
      body: audio.content,
      signal,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Azure ${response.status}: ${text.slice(0, 180)}`)
    const data = JSON.parse(text)
    if (data.RecognitionStatus !== 'Success') throw new Error(`Azure không nhận ra giọng nói: ${data.RecognitionStatus}`)
    return data.NBest?.[0] || {}
  }, STT_TIMEOUT_MS, 'Azure pronunciation')
}

function parsePhonemes(value) {
  if (!value) return []
  const parsed = JSON.parse(value)
  return Array.isArray(parsed) ? parsed : []
}

export async function handleAzureWord(req, res) {
  try {
    const { fields, files } = parseMultipart(req, await readBody(req))
    const audio = files.audio
    const referenceText = String(fields.referenceText || fields.text || '').trim()
    if (!referenceText) return json(res, 400, { detail: 'Missing referenceText.' })
    if (!audio?.content?.length) return json(res, 400, { detail: 'Missing audio.' })
    const nbest = await callPronunciationAzure({
      audio,
      referenceText,
      language: fields.language || 'en-US',
      prosody: true,
    })
    return json(res, 200, normalizeWordResult(nbest, parsePhonemes(fields.phonemes)))
  } catch (err) {
    return json(res, 502, { detail: err.message })
  }
}

export async function handleAzureSentence(req, res) {
  try {
    const { fields, files } = parseMultipart(req, await readBody(req))
    const audio = files.audio
    const referenceText = String(fields.referenceText || fields.text || '').trim()
    if (!referenceText) return json(res, 400, { detail: 'Missing referenceText.' })
    if (!audio?.content?.length) return json(res, 400, { detail: 'Missing audio.' })
    const nbest = await callPronunciationAzure({
      audio,
      referenceText,
      language: fields.language || 'en-US',
      prosody: true,
    })
    return json(res, 200, normalizeSentenceResult(nbest))
  } catch (err) {
    return json(res, 502, { detail: err.message })
  }
}

export async function handleAzureTts(req, res) {
  try {
    const { ssml } = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    if (!String(ssml || '').trim()) return json(res, 400, { detail: 'Missing ssml.' })
    const { key, region } = azureConfig()
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`
    const audio = await withTimeout(async signal => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'learnPronunciation',
        },
        body: ssml,
        signal,
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!response.ok) throw new Error(`Azure TTS ${response.status}: ${buffer.toString('utf8').slice(0, 180)}`)
      return buffer
    }, TTS_TIMEOUT_MS, 'Azure TTS')
    return send(res, 200, audio, { 'Content-Type': 'audio/mpeg' })
  } catch (err) {
    return json(res, 502, { detail: err.message })
  }
}
