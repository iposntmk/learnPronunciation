// Pure phoneme engine: lookup, IPA normalize/tokenize, g2p fallback, dictionary fetch.
// No React/UI — extracted from App.jsx.
import { SPANISH_PHONEME_INFO, ITALIAN_PHONEME_INFO, FRENCH_PHONEME_INFO } from '../data.js'
import { normalizeLanguage } from '../supabaseData.js'
import { PHONEME_INFO } from './phonemeInfo.js'
import { WORD_IPA_RAW, WORD_STRESS_IDX } from './wordIpaData.js'

const STRESS_VOWEL_MARKERS = [
  'ɛər', 'ɪər', 'ɑːr', 'ɔːr', 'ər',
  'iː', 'ɜː', 'uː', 'ɔː', 'ɑː',
  'oʊ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ',
  'ə', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ',
]

function hasStressBearingVowel(ipa) {
  return STRESS_VOWEL_MARKERS.some(marker => ipa.includes(marker))
}

export function unsupportedWord(word) {
  return [{
    text: word,
    ipa: '?',
    tip: 'Từ này chưa có IPA đáng tin trong từ điển English hiện tại',
    isHard: false,
    isStressed: false,
    canScore: false,
    lookupNote: 'Từ này chưa có IPA mẫu trong từ điển — vẫn thu âm được, Azure sẽ chấm theo cách viết.',
  }]
}

function normalizeWordEntry(raw, stressIdx = -1) {
  let vowelIdx = -1
  return raw.map(([text, ipa], i) => ({
    ...(hasStressBearingVowel(ipa) ? { __vowelIdx: ++vowelIdx } : { __vowelIdx: null }),
    text, ipa,
    tip: PHONEME_INFO[ipa]?.tip || `Âm /${ipa}/`,
    isHard: PHONEME_INFO[ipa]?.hard || false,
    isStressed: hasStressBearingVowel(ipa) && vowelIdx === stressIdx,
    canScore: true,
    lookupNote: null,
  })).map(({ __vowelIdx, ...entry }) => entry)
}

const EXTERNAL_DICT_CACHE = new Map()

const EN_FALLBACK_IPA_OVERRIDES = {
  commitment: '/kəˈmɪtmənt/',
  committee: '/kəˈmɪti/',
  competitor: '/kəmˈpetətər/',
  complex: '/kəmˈpleks/',
}

function stripIpaDecorators(ipa) {
  return ipa
    .replace(/^\/|\/$/g, '')
    .replace(/^\[|\]$/g, '')
    .replace(/[()]/g, '')
    .replace(/\./g, '')
    .trim()
}

function normalizeExternalIpa(ipa) {
  return stripIpaDecorators(ipa)
    .normalize('NFC')
    .replace(/ː/g, 'ː')
    .replace(/ˑ/g, 'ː')
    .replace(/l̩/g, 'əl')
    .replace(/m̩/g, 'əm')
    .replace(/n̩/g, 'ən')
    .replace(/ɹ/g, 'r')
    .replace(/ɡ/g, 'g')
    .replace(/ɚ/g, 'ər')
    .replace(/ɝ/g, 'ɜː')
    .replace(/ɜr/g, 'ɜːr')
    .replace(/ɫ/g, 'l')
    .replace(/ᵻ/g, 'ɪ')
    .replace(/ᵿ/g, 'ʊ')
    .replace(/ʔ/g, 't')
    .replace(/əʊ/g, 'oʊ')
    .replace(/əu/g, 'oʊ')
    .replace(/oː/g, 'oʊ')
    .replace(/ɔːɹ/g, 'ɔːr')
    .replace(/ɑːɹ/g, 'ɑːr')
    .replace(/ɜːɹ/g, 'ɜːr')
    .replace(/eə/g, 'ɛər')
    .replace(/ɪə/g, 'ɪər')
    .replace(/ʊə/g, 'ɔːr')
    .replace(/aə/g, 'aɪər')
}

const EXTERNAL_IPA_ATOMS = [
  'aɪər', 'aʊər', 'tʃ', 'dʒ', 'iː', 'ɜː', 'uː', 'ɔː', 'ɑː', 'oʊ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ',
  'ɛər', 'ɪər', 'ɑːr', 'ɔːr', 'ɜːr', 'ər', 'juː', 'kw', 'ks',
  'ŋk', 'ŋg', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ',
  'ə', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ', 'i', 'ɑ', 'ɒ', 'ɔ', 'e', 'a', 'ɜ', 'ɐ', 'ɾ',
  'p', 'b', 't', 'd', 'k', 'g', 'm', 'n', 'f', 'v', 's', 'z', 'h', 'r', 'j', 'w', 'l',
]

function tokenizeExternalIpa(rawIpa) {
  const ipa = normalizeExternalIpa(rawIpa)
  if (!ipa) return []

  const out = []
  let i = 0
  let stressNext = null // 'primary' | 'secondary' | null

  while (i < ipa.length) {
    const ch = ipa[i]
    if (ch === 'ˈ') {
      stressNext = 'primary'
      i++
      continue
    }
    if (ch === 'ˌ') {
      stressNext = 'secondary'
      i++
      continue
    }

    const stressFlags = { isStressed: stressNext === 'primary', isSecondaryStress: stressNext === 'secondary' }
    const atom = EXTERNAL_IPA_ATOMS.find(item => ipa.startsWith(item, i))
    if (!atom) {
      if (/[\s,_-]/.test(ch)) {
        i++
        continue
      }
      out.push({ ipa: ch, ...stressFlags })
      stressNext = null
      i++
      continue
    }
    out.push({ ipa: atom, ...stressFlags })
    stressNext = null
    i += atom.length
  }

  return out
}

function splitWordAcrossPhonemes(word, count) {
  const clean = word.trim()
  if (count <= 1) return [clean]

  const out = []
  let cursor = 0
  for (let i = 0; i < count; i++) {
    const remainingLetters = clean.length - cursor
    const remainingSlots = count - i
    const size = Math.max(1, Math.ceil(remainingLetters / remainingSlots))
    out.push(clean.slice(cursor, cursor + size))
    cursor += size
  }
  if (cursor < clean.length) out[out.length - 1] += clean.slice(cursor)
  return out
}

function splitSourceTextAcrossPhonemes(word, count) {
  const clean = String(word || '').trim()
  if (!clean || count <= 0) return []
  const chars = Array.from(clean)
  const spokenChars = chars.filter(ch => !/\s/.test(ch))
  if (spokenChars.length === count) {
    const chunks = []
    let pendingSpace = ''
    for (const ch of chars) {
      if (/\s/.test(ch)) {
        pendingSpace += ch
      } else {
        chunks.push(`${pendingSpace}${ch}`)
        pendingSpace = ''
      }
    }
    return chunks
  }
  return splitWordAcrossPhonemes(clean, count)
}

function buildExternalWordEntry(word, rawIpa) {
  const tokens = tokenizeExternalIpa(rawIpa)
  if (tokens.length === 0) return null
  const chunks = splitWordAcrossPhonemes(word, tokens.length)
  return tokens.map((token, index) => ({
    text: chunks[index] || '',
    ipa: token.ipa,
    tip: PHONEME_INFO[token.ipa]?.tip || `Âm /${token.ipa}/`,
    isHard: PHONEME_INFO[token.ipa]?.hard || false,
    isStressed: token.isStressed,
    isSecondaryStress: token.isSecondaryStress || false,
    canScore: true,
    lookupNote: null,
  }))
}

function buildRuleBasedWordEntry(word) {
  // Từ ngoài db: KHÔNG đoán g2p nữa. Chỉ dùng IPA curated chuẩn; không có → bỏ trống.
  const fallbackIpa = EN_FALLBACK_IPA_OVERRIDES[word.toLowerCase()]
  const built = fallbackIpa ? buildExternalWordEntry(word, fallbackIpa) : null
  return built || unsupportedWord(word)
}

export async function fetchEnglishDictionaryPhonemes(word) {
  const key = word.toLowerCase().trim()
  if (!key) return null
  if (EXTERNAL_DICT_CACHE.has(key)) return EXTERNAL_DICT_CACHE.get(key)

  const promise = (async () => {
    try {
      const phraseParts = key.split(/\s+/).filter(Boolean)
      if (phraseParts.length > 1) {
        const parts = []
        for (const part of phraseParts) {
          const found = await fetchEnglishDictionaryPhonemes(part)
          if (!found) return null
          parts.push(found)
        }
        return parts.flatMap((partEntries, partIndex) => partEntries.map((entry, entryIndex) => ({
          ...entry,
          text: partIndex > 0 && entryIndex === 0 ? ` ${entry.text}` : entry.text,
        })))
      }

      let resp = null
      for (let i = 0; i < 3; i++) {
        resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
        if (resp.ok) break
        await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)))
      }
      if (!resp?.ok) return buildRuleBasedWordEntry(key)
      const data = await resp.json()
      if (!Array.isArray(data)) return buildRuleBasedWordEntry(key)

      for (const entry of data) {
        const candidates = [
          ...(entry.phonetics || [])
            .filter(p => p?.text)
            .sort((a, b) => {
              const aUs = /\/us_|-us\.mp3|us_pron/i.test(a.audio || '')
              const bUs = /\/us_|-us\.mp3|us_pron/i.test(b.audio || '')
              return Number(bUs) - Number(aUs)
            })
            .map(p => p.text),
          entry.phonetic,
        ].filter(Boolean)

        for (const candidate of candidates) {
          const built = buildExternalWordEntry(key, candidate)
          if (built) return built
        }
      }
      return buildRuleBasedWordEntry(key)
    } catch {
      return buildRuleBasedWordEntry(key)
    }
  })()

  EXTERNAL_DICT_CACHE.set(key, promise)
  return promise
}

export function lookupWord(word, { allowGuess = true } = {}) {
  const w = word.toLowerCase().trim().replace(/[^a-z]/g, '')
  const raw = WORD_IPA_RAW[w]
  if (raw) {
    const stressIdx = WORD_STRESS_IDX[w] ?? -1
    return normalizeWordEntry(raw, stressIdx)
  }
  return allowGuess ? g2p(w) : unsupportedWord(w || word)
}

function g2p(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return unsupportedWord(word)
  const out = []
  let i = 0
  const voiced_th_words = new Set(['the','this','that','there','they','them','their','these','those','though','with','other','mother','father','brother','whether','weather','another','together','smooth','breathe'])
  const isVoicedThWord = voiced_th_words.has(w)

  while (i < w.length) {
    const rest = w.slice(i)
    const prev = i > 0 ? w[i - 1] : ''
    const next = w[i + 1] || ''
    let found = false
    const try2 = (pat, ipa) => {
      if (rest.startsWith(pat)) { out.push({ text: pat, ipa }); i += pat.length; found = true }
    }
    if (!found) try2('tch', 'tʃ')
    if (!found) try2('dge', 'dʒ')
    if (!found) try2('igh', 'aɪ')
    if (!found) try2('ght', 't')
    if (!found && rest.startsWith('tion')) { out.push({ text: 'tion', ipa: 'ʃən' }); i += 4; found = true }
    if (!found && rest.startsWith('sion')) { out.push({ text: 'sion', ipa: 'ʒən' }); i += 4; found = true }
    if (!found && rest.startsWith('ture')) { out.push({ text: 'ture', ipa: 'tʃər' }); i += 4; found = true }
    if (!found && rest.startsWith('th')) { out.push({ text: 'th', ipa: (isVoicedThWord || i > 0) ? 'ð' : 'θ' }); i += 2; found = true }
    if (!found) try2('sh', 'ʃ')
    if (!found) try2('ch', 'tʃ')
    if (!found) try2('ph', 'f')
    if (!found && rest.startsWith('wh')) { out.push({ text: 'wh', ipa: next === 'o' ? 'h' : 'w' }); i += 2; found = true }
    if (!found) try2('ck', 'k')
    if (!found && rest.startsWith('ng')) { out.push({ text: 'ng', ipa: 'aeiou'.includes(w[i + 2] || '') ? 'ŋg' : 'ŋ' }); i += 2; found = true }
    if (!found) try2('qu', 'kw')
    if (!found) try2('kn', 'n')
    if (!found) try2('wr', 'r')
    if (!found && rest.startsWith('mb') && i === w.length - 2) { out.push({ text: 'mb', ipa: 'm' }); i += 2; found = true }
    if (!found) try2('ee', 'iː')
    if (!found) try2('ea', 'iː')
    if (!found) try2('ai', 'eɪ')
    if (!found) try2('ay', 'eɪ')
    if (!found) try2('oa', 'oʊ')
    if (!found) try2('oi', 'ɔɪ')
    if (!found) try2('oy', 'ɔɪ')
    if (!found) try2('oo', 'uː')
    if (!found) try2('ou', 'aʊ')
    if (!found) try2('ow', 'aʊ')
    if (!found) try2('ew', 'juː')
    if (!found) try2('ue', 'uː')
    if (!found) try2('au', 'ɔː')
    if (!found) try2('aw', 'ɔː')
    if (!found) try2('er', 'ər')
    if (!found) try2('ir', 'ɜː')
    if (!found) try2('ur', 'ɜː')
    if (!found) try2('or', 'ɔːr')
    if (!found) try2('ar', 'ɑːr')
    if (!found) {
      const c = w[i]
      let ipa = c
      if (c === 'a') ipa = 'æ'
      else if (c === 'e') ipa = i === w.length - 1 ? null : 'ɛ'
      else if (c === 'i') ipa = 'ɪ'
      else if (c === 'o') ipa = 'ɑː'
      else if (c === 'u') ipa = 'ʌ'
      else if (c === 'y') ipa = i === 0 ? 'j' : 'i'
      else if (c === 'c') ipa = 'eiy'.includes(next) ? 's' : 'k'
      else if (c === 'g') ipa = 'eiy'.includes(next) ? 'dʒ' : 'g'
      else if (c === 's') ipa = 'aeiou'.includes(prev) && 'aeiou'.includes(next) ? 'z' : 's'
      else if (c === 'x') ipa = 'ks'
      else if (c === 'z') ipa = 'z'
      if (ipa !== null) out.push({ text: c, ipa })
      i++
    }
  }
  const built = out
    .filter(p => p.ipa && p.ipa !== '∅')
    .map(p => ({
      ...p,
      tip: PHONEME_INFO[p.ipa]?.tip || `Âm /${p.ipa}/`,
      isHard: PHONEME_INFO[p.ipa]?.hard || false,
      isStressed: false,
      isSecondaryStress: false,
      canScore: false,
      lookupNote: 'Từ này chưa có trong từ điển — IPA đoán theo rule, vẫn chấm được nhưng có thể chưa chuẩn 100%.',
    }))
  return applyGuessedStress(w, built)
}

// Đoán vị trí nhấn cho IPA g2p (không có dữ liệu chuẩn). Chỉ gắn nhấn chính (ˈ).
const G2P_FINAL_STRESS = /(?:ee|eer|ese|ette|esque|oon|aire|eur|ade)$/
const G2P_ANTEPENULT_STRESS = /(?:ity|ety|ify|ogy|ology|graphy|nomy|cracy|logist)$/
const G2P_PENULT_STRESS = /(?:tion|sion|cion|ic|ics|ical|ial|ian|ious|eous|ient|cious|tious|uous|ual)$/

function applyGuessedStress(word, phonemes) {
  const vowelIdx = []
  phonemes.forEach((p, i) => { if (hasStressBearingVowel(p.ipa)) vowelIdx.push(i) })
  const n = vowelIdx.length
  if (n === 0) return phonemes
  let syllable = 0
  if (n > 1) {
    const w = String(word || '').toLowerCase()
    if (G2P_FINAL_STRESS.test(w)) syllable = n - 1
    else if (G2P_ANTEPENULT_STRESS.test(w)) syllable = Math.max(0, n - 3)
    else if (G2P_PENULT_STRESS.test(w)) syllable = n - 2
    else syllable = 0
  }
  const target = vowelIdx[syllable]
  return phonemes.map((p, i) => i === target ? { ...p, isStressed: true } : p)
}

// Build a phoneme array from a word's embedded [text, ipa] pairs + language phoneme info
export function buildPhonemes(pairs, infoMap) {
  return pairs
    .map(([text, ipa]) => ({
      text, ipa,
      tip: infoMap[ipa]?.tip || `/${ipa}/`,
      isHard: infoMap[ipa]?.hard || false,
      isStressed: false,
      audioOffset: null,
      audioDuration: null,
    }))
    .filter(p => p.ipa)
}

function looksLikeIpaForScoring(raw, language = 'english') {
  const value = String(raw || '').trim()
  if (!value) return false
  if (normalizeLanguage(language) !== 'english') return true
  return /[əɪɛæʌʊɑɒɔɜθðʃʒŋˈː]/.test(value) || value.includes('´') || value.includes('’') || value.includes('з')
}

function normalizeSupabaseIpa(raw) {
  return String(raw || '')
    .trim()
    .replace(/Â´/g, 'ˈ')
    .replace(/´/g, 'ˈ')
    .replace(/[’']/g, 'ˈ')
    .replace(/з/g, 'ə')
}

function phonemeInfoForLanguage(language) {
  switch (language) {
    case 'spanish': return SPANISH_PHONEME_INFO
    case 'italian': return ITALIAN_PHONEME_INFO
    case 'french': return FRENCH_PHONEME_INFO
    default: return PHONEME_INFO
  }
}

export function phonemesFromSupabaseIpa(rawIpa, language = 'english', word = '') {
  if (!looksLikeIpaForScoring(rawIpa, language)) return null
  const normalized = normalizeSupabaseIpa(rawIpa)
  const tokens = tokenizeExternalIpa(normalized)
  const ipaParts = tokens.map(t => t.ipa).filter(Boolean)
  if (ipaParts.length < 2) return null
  const info = phonemeInfoForLanguage(language)
  const chunks = word ? splitSourceTextAcrossPhonemes(word, ipaParts.length) : []
  return ipaParts.map((ipa, index) => ({
    text: chunks[index] || ipa,
    ipa,
    tip: info[ipa]?.tip || PHONEME_INFO[ipa]?.tip || `Âm /${ipa}/`,
    isHard: info[ipa]?.hard ?? PHONEME_INFO[ipa]?.hard ?? false,
    isStressed: Boolean(tokens[index]?.isStressed),
    isSecondaryStress: Boolean(tokens[index]?.isSecondaryStress),
    canScore: true,
    lookupNote: null,
    audioOffset: null,
    audioDuration: null,
  }))
}
