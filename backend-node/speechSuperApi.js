import { createHash, randomUUID } from 'node:crypto'

export const SPEECHSUPER_CORE_TYPE = 'word.eval.promax'
export const SPEECHSUPER_URL = `https://api.speechsuper.com/${SPEECHSUPER_CORE_TYPE}`

function sha1(value) {
  return createHash('sha1').update(value).digest('hex')
}

export function audioType(filename) {
  return String(filename || '').split('.').pop()?.toLowerCase() || 'wav'
}

export function buildSpeechSuperParams({ appKey, secretKey, userId, text, type }) {
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
        request: { coreType: SPEECHSUPER_CORE_TYPE, refText: text, tokenId: randomUUID() },
      },
    },
  }
}

function scoreValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.round(Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)))
}

function intOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeSpeechSuper(raw, referenceText) {
  const word = raw?.result?.words?.[0] || {}
  const scores = word.scores || {}

  const syllables = (Array.isArray(scores.stress) ? scores.stress : []).map((item, index) => ({
    index,
    spell: String(item.spell || ''),
    phonetic: String(item.phonetic || ''),
    score: scoreValue(item.overall),
    refStress: intOrNull(item.ref_stress),
    actualStress: intOrNull(item.stress),
  }))

  const phonemes = (word.phonemes || []).map((item, index) => ({
    index,
    phoneme: String(item.phoneme || ''),
    soundLike: String(item.sound_like || ''),
    score: scoreValue(item.pronunciation),
    stressMark: intOrNull(item.stress_mark) ?? 0,
  }))

  const mispronunciations = (word.mispron || [])
    .map(item => ({
      type: intOrNull(item.type),
      standard: String(item.standard || ''),
      mistaken: String(item.mistaken || ''),
      offset: intOrNull(item.offset),
      confidence: scoreValue(item.confidence),
    }))
    .filter(item => item.standard || item.mistaken)

  const expected = syllables.find(item => item.refStress === 1)
  const actual = syllables.find(item => item.actualStress === 1)
  const issues = []
  if (expected && actual && expected.index !== actual.index) {
    issues.push({ type: 'stress-misplaced', expectedIndex: expected.index, actualIndex: actual.index, expectedSpell: expected.spell, actualSpell: actual.spell })
  } else if (expected && !actual) {
    issues.push({ type: 'stress-missing', expectedIndex: expected.index, expectedSpell: expected.spell })
  }

  return {
    status: 'success',
    provider: 'speechsuper',
    word: String(word.word || referenceText || ''),
    overall: scoreValue(scores.overall ?? raw?.result?.overall),
    pronunciationScore: scoreValue(scores.pronunciation ?? raw?.result?.pronunciation),
    stressScore: scoreValue(raw?.result?.stress),
    syllables,
    phonemes,
    mispronunciations,
    issues,
  }
}

export async function sendSpeechSuperRequest({ appKey, secretKey, userId, text, audio, timeoutMs = 12000 }) {
  const params = buildSpeechSuperParams({ appKey, secretKey, userId, text, type: audioType(audio.filename) })
  const form = new FormData()
  form.append('text', JSON.stringify(params))
  form.append('audio', new Blob([audio.content], { type: audio.type || 'audio/wav' }), audio.filename || 'speechsuper.wav')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(SPEECHSUPER_URL, {
      method: 'POST',
      headers: { 'Request-Index': '0' },
      body: form,
      signal: controller.signal,
    })
    return { response, rawText: await response.text() }
  } finally {
    clearTimeout(timer)
  }
}
