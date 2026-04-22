// ─── SHARED HELPERS ───────────────────────────────────────────────────────

function whisperScoreFromTranscript(data, phonemes) {
  const transcript = (data.text || '').trim().toLowerCase().replace(/[.,!?]/g, '')
  const spokenWord = transcript.split(/\s+/)[0] || transcript
  const targetWord = phonemes.map(p => p.text).join('').toLowerCase()
  const words = data.words || []
  const avgProb = words.length > 0
    ? words.reduce((s, w) => s + (w.probability ?? 1), 0) / words.length
    : 0.5
  const wordMatch = spokenWord === targetWord || transcript.includes(targetWord)
  const baseScore = Math.round(avgProb * 100)
  const overall = wordMatch ? baseScore : Math.max(0, baseScore - 25)
  const scored = phonemes.map(p => ({
    ...p,
    score: overall,
    note: !wordMatch && overall < 70 ? `Nghe như "${spokenWord}"` : null,
  }))
  return { phonemes: scored, overall, spokenWord }
}

async function audioBlobToPcmWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  ctx.close()

  let pcm
  if (decoded.sampleRate === 16000) {
    pcm = decoded.getChannelData(0)
  } else {
    const frames = Math.ceil(decoded.length / decoded.sampleRate * 16000)
    const offCtx = new OfflineAudioContext(1, frames, 16000)
    const src = offCtx.createBufferSource()
    src.buffer = decoded
    src.connect(offCtx.destination)
    src.start()
    const resampled = await offCtx.startRendering()
    pcm = resampled.getChannelData(0)
  }
  const wavBuf = new ArrayBuffer(44 + pcm.length * 2)
  const v = new DataView(wavBuf)
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true)
  ws(8, 'WAVE'); ws(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true)
  }
  return new Blob([wavBuf], { type: 'audio/wav' })
}

// ─── OPENAI WHISPER ────────────────────────────────────────────────────────

export async function scoreWordOpenAI(audioBlob, phonemes, apiKey) {
  const ext = audioBlob.type.includes('ogg') ? 'ogg'
    : audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append('file', audioBlob, `audio.${ext}`)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI API lỗi ${resp.status}`)
  }
  return whisperScoreFromTranscript(await resp.json(), phonemes)
}

// ─── GROQ WHISPER (FREE) ───────────────────────────────────────────────────

export async function scoreWordGroq(audioBlob, phonemes, apiKey) {
  const ext = audioBlob.type.includes('ogg') ? 'ogg'
    : audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append('file', audioBlob, `audio.${ext}`)
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq API lỗi ${resp.status}`)
  }
  return whisperScoreFromTranscript(await resp.json(), phonemes)
}

// ─── GOOGLE CLOUD SPEECH (FREE 60 phút/tháng) ─────────────────────────────

export async function scoreWordGoogleCloud(audioBlob, phonemes, apiKey) {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const base64 = btoa(binary)

  const mimeType = audioBlob.type || 'audio/webm'
  const encoding = mimeType.includes('ogg') ? 'OGG_OPUS'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'MP3'
    : 'WEBM_OPUS'

  const body = {
    config: {
      encoding,
      languageCode: 'en-US',
      enableWordConfidence: true,
      model: 'command_and_search',
      useEnhanced: true,
    },
    audio: { content: base64 },
  }

  const resp = await fetch(
    `https://speech.googleapis.com/v1p1beta1/speech:recognize?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Google Cloud API lỗi ${resp.status}`)
  }

  const data = await resp.json()
  if (!data.results?.length) throw new Error('Không nhận ra giọng nói. Thử nói to và rõ hơn.')

  const alt = data.results[0].alternatives[0]
  const transcript = (alt.transcript || '').trim().toLowerCase().replace(/[.,!?]/g, '')
  const spokenWord = transcript.split(/\s+/)[0] || transcript
  const targetWord = phonemes.map(p => p.text).join('').toLowerCase()
  const words = alt.words || []
  const avgConf = words.length > 0
    ? words.reduce((s, w) => s + (w.confidence ?? alt.confidence ?? 0.5), 0) / words.length
    : (alt.confidence ?? 0.5)
  const wordMatch = spokenWord === targetWord || transcript.includes(targetWord)
  const baseScore = Math.round(avgConf * 100)
  const overall = wordMatch ? baseScore : Math.max(0, baseScore - 25)
  const scored = phonemes.map(p => ({
    ...p,
    score: overall,
    note: !wordMatch && overall < 70 ? `Nghe như "${spokenWord}"` : null,
  }))
  return { phonemes: scored, overall, spokenWord }
}

// ─── AZURE SPEECH PRONUNCIATION ASSESSMENT ────────────────────────────────

import { recordAzureUsage } from './azureUsage.js'

const VOWEL_IPA_SET = new Set([
  'iː','ɪ','ɛ','æ','ʌ','ə','ɜː','uː','ʊ','ɔː','ɑː',
  'eɪ','aɪ','aʊ','oʊ','ɔɪ','ɛər','ɪər','ɑːr','ɔːr',
])

// 0-based index of stressed vowel (counting only vowel phonemes) for common EN words
const EN_STRESS_IDX = {
  about:1, after:0, again:1, always:0, another:1, answer:0,
  banana:1, beautiful:0, because:1, before:1, better:0,
  brother:0, butter:0, candy:0, careful:0, cheddar:0,
  city:0, computer:1, different:0, dinner:0, enjoy:1, enough:1,
  every:0, family:0, father:0, flower:0, funny:0, future:0,
  gentle:0, giggly:0, happy:0, hello:1, hippo:0, important:1,
  language:0, lazy:0, learning:0, lemon:0, little:0, lollipop:0,
  morning:0, mother:0, muddy:0, music:0, nature:0, necklace:0,
  nothing:0, only:0, open:0, other:0, people:0, photo:0,
  pretty:0, problem:0, pronunciation:3, question:0,
  really:0, shiny:0, sister:0, story:0, study:0, table:0,
  teacher:0, tiny:0, today:1, together:1, treasure:0, turtle:0,
  under:0, university:3, usual:0, vegetable:0, very:0,
  water:0, weather:0, wonderful:0, yogurt:0, yummy:0, zebra:0,
}

// Azure (en-US) returns lowercase ARPAbet-like phoneme names → IPA
const AZURE_TO_IPA_EN = {
  iy: 'iː', ih: 'ɪ', eh: 'ɛ', ae: 'æ', ah: 'ʌ', uw: 'uː', uh: 'ʊ',
  ao: 'ɔː', aa: 'ɑː', aw: 'aʊ', ay: 'aɪ', ow: 'oʊ', oy: 'ɔɪ',
  er: 'ɜː', ey: 'eɪ',
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g',
  f: 'f', v: 'v', th: 'θ', dh: 'ð', s: 's', z: 'z',
  sh: 'ʃ', zh: 'ʒ', hh: 'h', h: 'h', ch: 'tʃ', jh: 'dʒ',
  m: 'm', n: 'n', ng: 'ŋ', l: 'l', r: 'r', w: 'w', y: 'j',
}

// Azure es-ES phoneme IDs → IPA
const AZURE_TO_IPA_ES = {
  a: 'a', e: 'e', i: 'i', o: 'o', u: 'u',
  p: 'p', b: 'b', B: 'β', t: 't', d: 'd', D: 'ð',
  T: 'θ',
  k: 'k', g: 'g', G: 'ɣ', f: 'f', s: 's', S: 'ʃ',
  x: 'x', tS: 'tʃ', jj: 'j', y: 'j', j: 'j',
  m: 'm', n: 'n', N: 'ɲ', l: 'l', L: 'ʎ',
  r: 'ɾ', rr: 'r', R: 'r',
  w: 'w',
}

// Azure it-IT phoneme IDs → IPA
const AZURE_TO_IPA_IT = {
  a: 'a', e: 'e', E: 'ɛ', i: 'i', o: 'o', O: 'ɔ', u: 'u',
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g',
  f: 'f', v: 'v', s: 's', z: 'z', Z: 'ʒ',
  tS: 'tʃ', dZ: 'dʒ', ts: 'ts', dz: 'dz',
  S: 'ʃ', r: 'r', l: 'l', L: 'ʎ',
  m: 'm', n: 'n', J: 'ɲ',
  w: 'w', j: 'j',
}

// Azure fr-FR phoneme IDs → IPA  (SAMPA-style IDs used by Azure)
const AZURE_TO_IPA_FR = {
  a: 'a', e: 'e', E: 'ɛ', i: 'i', o: 'o', O: 'ɔ', u: 'u', y: 'y',
  '2': 'ø', '9': 'œ', '@': 'ə',
  'a~': 'ɑ̃', 'E~': 'ɛ̃', 'o~': 'ɔ̃', '9~': 'œ̃',
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g',
  f: 'f', v: 'v', s: 's', z: 'z',
  S: 'ʃ', Z: 'ʒ',
  m: 'm', n: 'n', J: 'ɲ', N: 'ŋ',
  l: 'l', R: 'ʁ',
  j: 'j', w: 'w', H: 'ɥ',
}

const AZURE_PHONEME_MAPS = {
  'en-US': AZURE_TO_IPA_EN,
  'es-ES': AZURE_TO_IPA_ES,
  'it-IT': AZURE_TO_IPA_IT,
  'fr-FR': AZURE_TO_IPA_FR,
}

const EN_ATOMIC_IPA = [
  'tʃ', 'dʒ', 'iː', 'ɜː', 'uː', 'ɔː', 'ɑː', 'oʊ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ',
  'ɾ', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ',
  'ə', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ', 'i', 'ɑ', 'ɒ', 'ɔ', 'e', 'a', 'ɜ', 'ɐ', 'ɾ',
  'p', 'b', 't', 'd', 'k', 'g', 'm', 'n', 'f', 'v', 's', 'z', 'h', 'r', 'j', 'w', 'l',
]

const ES_ATOMIC_IPA = [
  'tʃ', 'β', 'ð', 'ɣ', 'ɲ', 'ʎ', 'ɾ', 'r', 'θ', 'ʃ', 'x',
  'a', 'e', 'i', 'o', 'u', 'p', 'b', 't', 'd', 'k', 'g', 'f', 's', 'j', 'w', 'm', 'n', 'l',
]

const IT_ATOMIC_IPA = [
  'tʃ', 'dʒ', 'ts', 'dz', 'ɲ', 'ʎ', 'ʃ', 'ʒ',
  'ɛ', 'ɔ',
  'a', 'e', 'i', 'o', 'u',
  'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 's', 'z', 'r', 'l', 'm', 'n', 'j', 'w',
]

const EN_IPA_EXPANSIONS = {
  'ɑːr': ['ɑː', 'r'],
  'ɔːr': ['ɔː', 'r'],
  'ɛər': ['ɛ', 'r'],
  'ɪər': ['ɪ', 'r'],
  'ər': ['ɜː'],
  'ɑ': ['ɑː'],
  'ɒ': ['ɑː'],
  'ɔ': ['ɔː'],
  'e': ['ɛ'],
  'a': ['æ'],
  'ɜ': ['ɜː'],
  'ɐ': ['ʌ'],
  'ŋk': ['ŋ', 'k'],
  'ŋg': ['ŋ', 'g'],
}

const ES_IPA_EXPANSIONS = {
  'br': ['β', 'r'],
  'tr': ['t', 'r'],
  'dr': ['d', 'r'],
  'gr': ['g', 'r'],
  'kr': ['k', 'r'],
  'pr': ['p', 'r'],
  'fr': ['f', 'r'],
  'pl': ['p', 'l'],
  'bl': ['β', 'l'],
  'kl': ['k', 'l'],
  'gl': ['g', 'l'],
  'gw': ['g', 'w'],
  'ai': ['a', 'i'],
  'ei': ['e', 'i'],
  'oi': ['o', 'i'],
  'ui': ['u', 'i'],
  'ja': ['j', 'a'],
  'je': ['j', 'e'],
  'jo': ['j', 'o'],
  'ju': ['j', 'u'],
  'wa': ['w', 'a'],
  'we': ['w', 'e'],
  'wi': ['w', 'i'],
  'wo': ['w', 'o'],
  'ks': ['k', 's'],
}

const IT_IPA_EXPANSIONS = {
  br: ['b', 'r'],
  tr: ['t', 'r'],
  dr: ['d', 'r'],
  gr: ['g', 'r'],
  kr: ['k', 'r'],
  pr: ['p', 'r'],
  fr: ['f', 'r'],
  skr: ['s', 'k', 'r'],
  sk: ['s', 'k'],
  kw: ['k', 'w'],
  kj: ['k', 'j'],
  gj: ['g', 'j'],
  fj: ['f', 'j'],
  lj: ['l', 'j'],
  ja: ['j', 'a'],
  je: ['j', 'e'],
  ji: ['j', 'i'],
  jo: ['j', 'o'],
  ju: ['j', 'u'],
  wa: ['w', 'a'],
  we: ['w', 'e'],
  wi: ['w', 'i'],
  wo: ['w', 'o'],
  ai: ['a', 'i'],
  ei: ['e', 'i'],
  oi: ['o', 'i'],
  tʃ: ['t', 'ʃ'],
  dʒ: ['d', 'ʒ'],
  ts: ['t', 's'],
  dz: ['d', 'z'],
  'ʎʎ': ['ʎ', 'ʎ'],
  'ɲɲ': ['ɲ', 'ɲ'],
  'ʃʃ': ['ʃ', 'ʃ'],
}

function expandEnglishTargetIpa(ipa) {
  if (EN_IPA_EXPANSIONS[ipa]) return EN_IPA_EXPANSIONS[ipa]

  const out = []
  let i = 0
  while (i < ipa.length) {
    const match = EN_ATOMIC_IPA.find(atom => ipa.startsWith(atom, i))
    if (!match) return [ipa]
    out.push(match)
    i += match.length
  }
  return out.length > 0 ? out : [ipa]
}

function expandSpanishTargetIpa(ipa) {
  if (ES_IPA_EXPANSIONS[ipa]) return ES_IPA_EXPANSIONS[ipa]

  const out = []
  let i = 0
  while (i < ipa.length) {
    const match = ES_ATOMIC_IPA.find(atom => ipa.startsWith(atom, i))
    if (!match) return [ipa]
    out.push(match)
    i += match.length
  }
  return out.length > 0 ? out : [ipa]
}

function expandItalianTargetIpa(ipa) {
  if (IT_IPA_EXPANSIONS[ipa]) return IT_IPA_EXPANSIONS[ipa]

  const out = []
  let i = 0
  while (i < ipa.length) {
    const match = IT_ATOMIC_IPA.find(atom => ipa.startsWith(atom, i))
    if (!match) return [ipa]
    out.push(match)
    i += match.length
  }
  return out.length > 0 ? out : [ipa]
}

function scoreExpandedTargetPhonemes(targetPhonemes, azurePhonemes, overallScore, expandTargetIpa) {
  let cursor = 0

  return targetPhonemes.map(target => {
    const parts = expandTargetIpa(target.ipa)
    const matched = []
    let searchFrom = cursor

    const exactHit = azurePhonemes.findIndex((ap, i) => i >= cursor && ap.ipa === target.ipa)
    if (exactHit !== -1) {
      matched.push(azurePhonemes[exactHit])
      searchFrom = exactHit + 1
    } else for (const part of parts) {
      let hit = -1
      for (let i = searchFrom; i < azurePhonemes.length; i++) {
        if (azurePhonemes[i].ipa === part) {
          hit = i
          break
        }
      }
      if (hit === -1) continue
      matched.push(azurePhonemes[hit])
      searchFrom = hit + 1
    }

    if (matched.length > 0) cursor = matched[matched.length - 1].index + 1

    const score = matched.length > 0
      ? Math.round(matched.reduce((sum, item) => sum + item.score, 0) / matched.length)
      : overallScore

    const offset = matched.length > 0 ? matched[0].offset : null
    const duration = matched.length > 0
      ? matched.reduce((sum, item) => sum + item.duration, 0)
      : null

    return {
      ...target,
      score,
      audioOffset: offset,
      audioDuration: duration,
      note: score < 60 ? `Âm /${target.ipa}/ cần luyện thêm` : null,
    }
  })
}

function scoreEnglishTargetPhonemes(targetPhonemes, azurePhonemes, overallScore) {
  return scoreExpandedTargetPhonemes(targetPhonemes, azurePhonemes, overallScore, expandEnglishTargetIpa)
}

function scoreSpanishTargetPhonemes(targetPhonemes, azurePhonemes, overallScore) {
  return scoreExpandedTargetPhonemes(targetPhonemes, azurePhonemes, overallScore, expandSpanishTargetIpa)
}

function scoreItalianTargetPhonemes(targetPhonemes, azurePhonemes, overallScore) {
  return scoreExpandedTargetPhonemes(targetPhonemes, azurePhonemes, overallScore, expandItalianTargetIpa)
}

export async function scoreWordAzure(audioBlob, phonemes, subscriptionKey, region, language = 'en-US') {
  const wavBlob = await audioBlobToPcmWav(audioBlob)
  const targetWord = phonemes.map(p => p.text).join('')

  // Track usage: WAV is 16kHz 16-bit mono → 2 bytes/sample
  const wavDurationSeconds = wavBlob.size / (16000 * 2)
  recordAzureUsage(wavDurationSeconds)

  const assessmentCfg = {
    ReferenceText: targetWord,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    EnableProsodyAssessment: false,
  }
  // Strip any CR/LF that btoa may insert; also trim key to avoid whitespace from secrets
  const cleanKey = subscriptionKey.trim().replace(/[\r\n]/g, '')
  const cleanRegion = region.trim().replace(/[\r\n]/g, '')
  const assessmentHeader = btoa(JSON.stringify(assessmentCfg)).replace(/[\r\n]/g, '')

  const url = `https://${cleanRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`
  console.log('[Azure] POST', url, '| word:', targetWord, '| keyLen:', cleanKey.length, '| keyPrefix:', cleanKey.slice(0, 6) + '...')
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cleanKey,
      'Content-Type': 'audio/wav',
      'Pronunciation-Assessment': assessmentHeader,
    },
    body: wavBlob,
  })
  console.log('[Azure] response status:', resp.status, resp.statusText)

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    console.error('[Azure] error body:', txt)
    const hint = resp.status === 401
      ? ' — Key sai hoặc hết hạn. Kiểm tra lại GitHub Secret AZUREKEY.'
      : resp.status === 403 ? ' — Không có quyền truy cập resource.'
      : resp.status === 0 ? ' — CORS bị chặn.'
      : ''
    throw new Error(`Azure ${resp.status}${hint} ${txt.slice(0, 150)}`)
  }

  const data = await resp.json()

  if (data.RecognitionStatus !== 'Success') {
    throw new Error(`Azure không nhận ra giọng nói: ${data.RecognitionStatus}`)
  }

  const nbest = data.NBest?.[0]
  const azureWord = nbest?.Words?.[0] || null
  const spokenWord = (nbest?.Lexical || '').trim().toLowerCase().replace(/[.,!?]/g, '').split(/\s+/)[0] || ''
  // Scores are directly on NBest[0], not nested under PronunciationAssessment
  const overallScore = Math.round(nbest?.PronScore ?? nbest?.AccuracyScore ?? 0)

  // Build ordered Azure phoneme list so repeated sounds are matched by position,
  // not by a single ipa -> best-score map.
  const phonemeMap = AZURE_PHONEME_MAPS[language] || AZURE_TO_IPA_EN
  const azurePhonemes = (nbest?.Words?.[0]?.Phonemes || []).map((ap, index) => {
    const rawId = ap.Phoneme || ''
    const ipa = phonemeMap[rawId] || phonemeMap[rawId.toLowerCase()]
    if (!ipa) return null
    return {
      index,
      ipa,
      score: Math.round(ap.AccuracyScore ?? ap.PronunciationAssessment?.AccuracyScore ?? 0),
      offset: (ap.Offset ?? 0) / 10_000_000,
      duration: (ap.Duration ?? 0) / 10_000_000,
    }
  }).filter(Boolean)

  const scored = language === 'en-US'
    ? scoreEnglishTargetPhonemes(phonemes, azurePhonemes, overallScore)
    : language === 'es-ES'
      ? scoreSpanishTargetPhonemes(phonemes, azurePhonemes, overallScore)
      : language === 'it-IT'
        ? scoreItalianTargetPhonemes(phonemes, azurePhonemes, overallScore)
    : phonemes.map(p => {
        const match = azurePhonemes.find(ap => ap.ipa === p.ipa) || null
        const score = match ? match.score : overallScore
        return {
          ...p,
          score,
          audioOffset: match?.offset ?? null,
          audioDuration: match?.duration ?? null,
          note: score < 60 ? `Âm /${p.ipa}/ cần luyện thêm` : null,
        }
      })

  const overall = scored.length > 0
    ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length)
    : overallScore

  return { phonemes: scored, overall, spokenWord, stress: null }
}
