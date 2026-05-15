import { normalizeLanguage } from '../supabaseData.js'

function uniqueList(items) {
  const seen = new Set()
  return items
    .map(item => String(item || '').trim())
    .filter(item => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function isUsefulWordMeaning(item) {
  const meaning = item?.meaningVi || ''
  const definition = item?.definitionEn || ''
  return Boolean(meaning)
    && !/^Một .+ tiếng Anh thông dụng\./i.test(meaning)
    && !/^Một .+ thông dụng trong tiếng Anh\./i.test(meaning)
    && !/^A common English /i.test(definition)
}

export function practiceExampleForLanguage(word, language = 'english') {
  switch (normalizeLanguage(language)) {
    case 'spanish': return `Puedo decir "${word}" claramente.`
    case 'italian': return `Posso dire "${word}" chiaramente.`
    case 'french': return `Je peux dire "${word}" clairement.`
    default: return `I can say "${word}" clearly.`
  }
}

export function practiceExampleTranslationForLanguage(word, language = 'english') {
  switch (normalizeLanguage(language)) {
    case 'spanish':
    case 'italian':
    case 'french':
      return `Tôi có thể nói "${word}" rõ ràng.`
    default:
      return `Tôi có thể nói "${word}" rõ ràng.`
  }
}

export function buildTranslateFallbackDetail(word, meaning = '', language = 'english') {
  const cleanMeaning = meaning && !/^\d+\/\d+/.test(meaning) ? meaning : 'Google Translate available'
  const example = practiceExampleForLanguage(word, language)
  return {
    word,
    level: null,
    language: normalizeLanguage(language),
    meanings: [
      {
        pos: 'translate',
        definitionEn: '',
        meaningVi: 'Use Google Translate to view the Vietnamese meaning.',
        exampleEn: `Translate: ${word}`,
        exampleVi: 'No local usage example is available yet.',
      },
      {
        pos: word.includes(' ') ? 'phrase' : 'word',
        definitionEn: `A practice ${word.includes(' ') ? 'phrase' : 'word'} used in pronunciation training.`,
        meaningVi: cleanMeaning,
        exampleEn: example,
        exampleVi: practiceExampleTranslationForLanguage(word, language),
      },
    ],
  }
}

export function supabaseWordToEntry(row) {
  return {
    id: row.id,
    word: row.word,
    level: row.level || row.categories?.level || 'A1',
    pos: row.type || 'other',
    categoryId: row.category_id || null,
    categoryName: row.categories?.name || null,
    ipa: row.ipa || null,
    meaningVi: row.vietnamese_definition || '',
    exampleEn: row.example_sentence || '',
    rootWord: row.root_word || '',
    familyWords: row.family_words || [],
    synonyms: row.synonyms || [],
    antonyms: row.antonyms || [],
    language: row.language || 'english',
  }
}

export function buildSupabaseWordDetail(entry) {
  const language = normalizeLanguage(entry.language)
  return {
    word: entry.word,
    level: entry.level,
    ipa: entry.ipa || null,
    language,
    meanings: [
      {
        pos: entry.pos || 'word',
        definitionEn: entry.categoryName ? `Category: ${entry.categoryName}` : '',
        meaningVi: entry.meaningVi || 'Google Translate available',
        exampleEn: entry.exampleEn || practiceExampleForLanguage(entry.word, language),
        exampleVi: '',
      },
    ],
    relations: {
      rootWord: entry.rootWord || '',
      family: uniqueList([entry.rootWord, ...(entry.familyWords || [])]).slice(0, 8),
      synonyms: uniqueList(entry.synonyms || []).slice(0, 8),
      antonyms: uniqueList(entry.antonyms || []).slice(0, 8),
    },
  }
}

export function dictionaryWordKey(word, language = 'english') {
  return `${normalizeLanguage(language)}:${String(word || '').trim().toLowerCase()}`
}

export const DICTIONARY_CACHE_KEY = 'dictionaryWordsCacheV3'
export const DICTIONARY_CATEGORIES_CACHE_KEY = 'dictionaryCategoriesCacheV3'
export const DICTIONARY_PAGE_SIZE = 150
const dictionaryMemoryCache = new Map()

export function loadDictionaryCache(key) {
  try {
    if (dictionaryMemoryCache.has(key)) return dictionaryMemoryCache.get(key)
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    if (!parsed || !Array.isArray(parsed.items)) return null
    dictionaryMemoryCache.set(key, parsed)
    return parsed
  } catch {
    return null
  }
}

export function saveDictionaryCache(key, items) {
  try {
    const safeItems = items.map(({ sourceRow, ...item }) => item)
    const payload = { updatedAt: new Date().toISOString(), items: safeItems }
    dictionaryMemoryCache.set(key, payload)
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {}
}

export function searchDictionaryEntries(entries, term, language = 'all') {
  const q = String(term || '').trim().toLowerCase()
  if (!q) return []
  return entries.filter(entry => {
    if (language !== 'all' && normalizeLanguage(entry.language) !== normalizeLanguage(language)) return false
    return entry.word.toLowerCase().includes(q)
      || entry.meaningVi.toLowerCase().includes(q)
      || entry.rootWord.toLowerCase().includes(q)
  })
}
