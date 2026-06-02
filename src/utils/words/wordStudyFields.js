import { normalizeLanguage } from '../../supabaseData.js'
import { practiceExampleForLanguage } from '../dictionaryHelpers.js'
import { deriveRootWord } from './wordRelations.js'

const GOOGLE_SOURCE_LANGUAGE = {
  english: 'en',
  spanish: 'es',
  italian: 'it',
  french: 'fr',
}

function googleTranslateApiUrl(text, language = 'english') {
  const source = GOOGLE_SOURCE_LANGUAGE[normalizeLanguage(language)] || 'en'
  return `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=vi&dt=t&q=${encodeURIComponent(text)}`
}

export async function fetchVietnameseTranslation(text, language = 'english') {
  const resp = await fetch(googleTranslateApiUrl(text, language))
  if (!resp.ok) throw new Error('Không dịch tự động được.')
  const data = await resp.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0]).filter(Boolean).join('')
    : ''
  if (!translated) throw new Error('Không có kết quả dịch.')
  return translated
}

export async function fetchJsonOrNull(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

function uniqueCleanList(values, blocked = []) {
  const blockedSet = new Set(blocked.map(value => String(value).toLowerCase()))
  const seen = new Set()
  return values
    .map(value => String(value || '').trim().toLowerCase())
    .filter(value => value && !blockedSet.has(value) && /^[a-z][a-z\s'-]*$/i.test(value))
    .filter(value => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function flattenDictionaryMeanings(entries) {
  return (Array.isArray(entries) ? entries : [])
    .flatMap(entry => entry?.meanings || [])
    .flatMap(meaning => (meaning?.definitions || []).map(definition => ({
      partOfSpeech: meaning.partOfSpeech || '',
      definition: definition.definition || '',
      example: definition.example || '',
      synonyms: [...(meaning.synonyms || []), ...(definition.synonyms || [])],
      antonyms: [...(meaning.antonyms || []), ...(definition.antonyms || [])],
    })))
}

function normalizePartOfSpeech(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'adjective' || text === 'adj') return 'adjective'
  if (text === 'adverb' || text === 'adv') return 'adverb'
  if (text === 'noun' || text === 'n') return 'noun'
  if (text === 'verb' || text === 'v') return 'verb'
  if (text === 'phrase' || text === 'idiom') return 'phrase'
  return text
}

function partOfSpeechMatches(actual, expected) {
  const a = normalizePartOfSpeech(actual)
  const e = normalizePartOfSpeech(expected)
  if (!e || e === 'other') return true
  if (e === 'phrase') return a === 'phrase' || a === 'idiom'
  return a === e
}

export async function fetchWordStudyFields(word, type = 'other', language = 'english') {
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) throw new Error('Word is required.')
  const sourceLanguage = normalizeLanguage(language)

  if (sourceLanguage !== 'english') {
    const vietnameseDefinition = await fetchVietnameseTranslation(normalized, sourceLanguage)
    return {
      vietnamese_definition: vietnameseDefinition,
      example_sentence: practiceExampleForLanguage(normalized, sourceLanguage),
      root_word: '',
      family_words: [],
      synonyms: [],
      antonyms: [],
      language: sourceLanguage,
    }
  }

  const [dictionaryResult, synonymResult, antonymResult] = await Promise.allSettled([
    fetchJsonOrNull(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`),
    fetchJsonOrNull(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(normalized)}&max=10`),
    fetchJsonOrNull(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(normalized)}&max=10`),
  ])
  const dictionaryEntries = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null
  const dictionaryMeanings = flattenDictionaryMeanings(dictionaryEntries)
  const typeMeanings = dictionaryMeanings.filter(item => partOfSpeechMatches(item.partOfSpeech, type))
  const scopedMeanings = typeMeanings.length ? typeMeanings : dictionaryMeanings
  const firstMeaning = scopedMeanings.find(item => item.definition) || null
  const example = scopedMeanings.find(item => item.example)?.example || `I can use "${normalized}" in a sentence.`
  const definitionText = firstMeaning?.definition || normalized

  let vietnameseDefinition = type === 'other'
    ? await fetchVietnameseTranslation(normalized, sourceLanguage)
    : ''
  if (!vietnameseDefinition || vietnameseDefinition.toLowerCase() === normalized) {
    vietnameseDefinition = await fetchVietnameseTranslation(definitionText, sourceLanguage)
  }

  const rootWord = deriveRootWord(normalized)
  const familyQuery = rootWord || normalized
  const familyResult = familyQuery
    ? await fetchJsonOrNull(`https://api.datamuse.com/words?sp=${encodeURIComponent(familyQuery)}*&max=12`)
    : null

  const synonyms = uniqueCleanList([
    ...scopedMeanings.flatMap(item => item.synonyms || []),
    ...((synonymResult.status === 'fulfilled' && Array.isArray(synonymResult.value)) ? synonymResult.value.map(item => item.word) : []),
  ], [normalized]).slice(0, 8)

  const antonyms = uniqueCleanList([
    ...scopedMeanings.flatMap(item => item.antonyms || []),
    ...((antonymResult.status === 'fulfilled' && Array.isArray(antonymResult.value)) ? antonymResult.value.map(item => item.word) : []),
  ], [normalized]).slice(0, 8)

  const familyWords = uniqueCleanList(
    Array.isArray(familyResult) ? familyResult.map(item => item.word) : [],
    [normalized, rootWord]
  ).slice(0, 8)

  return {
    vietnamese_definition: vietnameseDefinition,
    example_sentence: example,
    root_word: rootWord,
    family_words: familyWords,
    synonyms,
    antonyms,
    language: sourceLanguage,
  }
}
