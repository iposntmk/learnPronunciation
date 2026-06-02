import { json, readBody, send } from './http.js'

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'
const TTS_TIMEOUT_MS = 15000

function clean(value) {
  return String(value || '').trim().replace(/[\r\n]/g, '')
}

function apiKey() {
  return clean(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_KEY || process.env.EVENLABS_API_KEY)
}

function voiceId() {
  return clean(process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID)
}

function modelId() {
  return clean(process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID)
}

function outputFormat() {
  return clean(process.env.ELEVENLABS_OUTPUT_FORMAT || DEFAULT_OUTPUT_FORMAT)
}

function languageCode(language) {
  const value = clean(language)
  const code = value.split('-')[0].toLowerCase()
  return ['en', 'es', 'it', 'fr'].includes(code) ? code : null
}

export function elevenLabsStatus() {
  return {
    elevenLabsConfigured: Boolean(apiKey()),
    elevenLabsKeyConfigured: Boolean(apiKey()),
    elevenLabsVoiceId: voiceId(),
    elevenLabsModelId: modelId(),
    elevenLabsEndpoint: '/elevenlabs/tts',
  }
}

async function withTimeout(promiseFactory) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)
  try {
    return await promiseFactory(controller.signal)
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('ElevenLabs TTS timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function handleElevenLabsTts(req, res) {
  try {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const text = String(body.text || '').trim()
    if (!text) return json(res, 400, { detail: 'Missing text.' })

    const key = apiKey()
    if (!key) return json(res, 500, { detail: 'ElevenLabs API key chưa được cấu hình trong backend.' })

    const selectedVoiceId = clean(body.voiceId) || voiceId()
    const selectedModelId = clean(body.modelId) || modelId()
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoiceId)}?output_format=${encodeURIComponent(outputFormat())}`
    const payload = {
      text,
      model_id: selectedModelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0,
        use_speaker_boost: true,
      },
    }
    const lang = languageCode(body.language)
    if (lang) payload.language_code = lang

    const audio = await withTimeout(async signal => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      })
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${buffer.toString('utf8').slice(0, 180)}`)
      return { buffer, type: response.headers.get('content-type') || 'audio/mpeg' }
    })

    return send(res, 200, audio.buffer, { 'Content-Type': audio.type, 'Cache-Control': 'no-store' })
  } catch (err) {
    return json(res, 502, { detail: err.message })
  }
}
