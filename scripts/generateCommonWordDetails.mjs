import fs from 'node:fs/promises'
import { COMMON_3000_WORDS } from '../src/commonWords.js'

const OUT = new URL('../src/commonWordDetails.js', import.meta.url)
const DICT = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
const TRANSLATE = 'https://translate.googleapis.com/translate_a/single'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const POS_ALIAS = {
  adjective: ['adjective', 'adj'],
  adverb: ['adverb', 'adv'],
  conjunction: ['conjunction', 'conj'],
  determiner: ['determiner', 'det'],
  exclamation: ['exclamation', 'interjection'],
  'indefinite article': ['article', 'indefinite article'],
  'definite article': ['article', 'definite article'],
  'infinitive marker': ['particle', 'infinitive marker'],
  'modal verb': ['modal verb', 'verb'],
  noun: ['noun'],
  number: ['number', 'numeral'],
  preposition: ['preposition', 'prep'],
  pronoun: ['pronoun'],
  verb: ['verb'],
  auxiliary: ['auxiliary', 'verb'],
}

function splitPos(pos) {
  return [...new Set(pos
    .split(',')
    .map(item => item.trim())
    .filter(Boolean))]
}

function posMatches(sourcePos, targetPos) {
  const aliases = POS_ALIAS[targetPos] || [targetPos]
  const source = sourcePos.toLowerCase()
  return aliases.some(alias => source === alias || source.includes(alias))
}

function makeExample(word, pos) {
  const clean = word.toLowerCase()
  if (pos.includes('verb')) return `We need to ${clean} today.`
  if (pos === 'adjective') return `This is a ${clean} example.`
  if (pos === 'adverb') return `She said it ${clean}.`
  if (pos === 'noun') return `This ${clean} is important.`
  if (pos === 'preposition') return `The book is ${clean} the table.`
  if (pos === 'conjunction') return `I stayed home ${clean} it rained.`
  if (pos === 'pronoun') return `${word[0].toUpperCase()}${word.slice(1)} is used very often.`
  if (pos === 'number') return `I can say ${clean} clearly.`
  if (pos === 'exclamation') return `${word[0].toUpperCase()}${word.slice(1)}! That sounds clear.`
  return `${word[0].toUpperCase()}${word.slice(1)} is a useful English word.`
}

function conciseDefinition(meaning) {
  const def = meaning?.definitions?.find(item => {
    const text = item.definition || ''
    return text
      && !/Plato|Platonist|usually capitalized|obsolete|archaic/i.test(text)
  })?.definition || meaning?.definitions?.find(item => item.definition)?.definition
  if (!def) return null
  return def.replace(/\s+/g, ' ').trim()
}

function exampleFromMeaning(meaning) {
  const example = meaning?.definitions?.find(item => item.example && !/Plato|Platonist/i.test(item.example))?.example
  return example ? example.replace(/\s+/g, ' ').trim() : null
}

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) {
        await wait(resp.status === 429 ? 1200 * (i + 1) : 400 * (i + 1))
        continue
      }
      return await resp.json()
    } catch {
      await wait(300 * (i + 1))
    }
  }
  return null
}

async function fetchDictionaryEntry(word) {
  const data = await fetchJson(`${DICT}${encodeURIComponent(word)}`)
  if (Array.isArray(data) && data[0]?.meanings) return data[0]
  return null
}

function buildEnglishDetails(entry, dictEntry) {
  const meanings = dictEntry?.meanings || []
  return splitPos(entry.pos).map(pos => {
    const match = meanings.find(item => posMatches(item.partOfSpeech || '', pos))
      || meanings.find(item => (item.definitions || []).length > 0)

    const definitionEn = conciseDefinition(match) || `A common English ${pos}.`
    const exampleEn = exampleFromMeaning(match) || makeExample(entry.word, pos)

    return {
      pos,
      definitionEn,
      meaningVi: '',
      exampleEn,
      exampleVi: '',
    }
  })
}

const translateCache = new Map()

async function translateText(text) {
  if (!text) return ''
  if (translateCache.has(text)) return translateCache.get(text)

  const url = new URL(TRANSLATE)
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', 'vi')
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  for (let i = 0; i < 4; i++) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`translate ${resp.status}`)
      const data = await resp.json()
      const translated = Array.isArray(data?.[0])
        ? data[0].map(part => part?.[0] || '').join('').trim()
        : ''
      if (translated) {
        translateCache.set(text, translated)
        return translated
      }
    } catch {
      await wait(500 * (i + 1))
    }
  }

  translateCache.set(text, '')
  return ''
}

async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return out
}

const dictionaryEntries = await mapLimit(COMMON_3000_WORDS, 3, async (entry, index) => {
  if (index % 100 === 0) console.log(`dictionary ${index}/${COMMON_3000_WORDS.length}`)
  return fetchDictionaryEntry(entry.word)
})

const details = COMMON_3000_WORDS.map((entry, index) => ({
  word: entry.word,
  level: entry.level,
  meanings: buildEnglishDetails(entry, dictionaryEntries[index]),
}))

const OVERRIDES = {
  academic: [
    {
      pos: 'adjective',
      definitionEn: 'Related to school, university, study, or research.',
      meaningVi: 'thuộc về học tập, trường học, đại học hoặc nghiên cứu',
      exampleEn: 'She writes academic articles.',
      exampleVi: 'Cô ấy viết các bài báo học thuật.',
    },
    {
      pos: 'noun',
      definitionEn: 'A teacher or researcher at a college or university.',
      meaningVi: 'giảng viên hoặc nhà nghiên cứu ở trường cao đẳng/đại học',
      exampleEn: 'He is an academic at a university.',
      exampleVi: 'Anh ấy là một học giả ở một trường đại học.',
    },
  ],
}

for (const item of details) {
  if (OVERRIDES[item.word]) item.meanings = OVERRIDES[item.word]
}

const translationJobs = []
for (const item of details) {
  for (const meaning of item.meanings) {
    if (!meaning.meaningVi) translationJobs.push({ target: meaning, field: 'meaningVi', text: meaning.definitionEn })
    if (!meaning.exampleVi) translationJobs.push({ target: meaning, field: 'exampleVi', text: meaning.exampleEn })
  }
}

await mapLimit(translationJobs, 6, async (job, index) => {
  if (index % 250 === 0) console.log(`translate ${index}/${translationJobs.length}`)
  job.target[job.field] = await translateText(job.text)
})

const body = `// Generated metadata for the 3000 common-word pronunciation menu.
// Meanings are organized by part of speech and include a simple English/Vietnamese example.

export const COMMON_3000_DETAILS = ${JSON.stringify(details, null, 2)}

export const COMMON_3000_DETAIL_MAP = Object.fromEntries(
  COMMON_3000_DETAILS.map(item => [item.word.toLowerCase(), item])
)
`

await fs.writeFile(OUT, body)
console.log(`wrote ${details.length} entries to ${OUT.pathname}`)
