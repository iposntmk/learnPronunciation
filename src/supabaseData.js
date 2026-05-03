import { requireSupabase } from './supabaseClient.js'

export const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const WORD_LANGUAGES = ['english', 'spanish', 'italian', 'french']

const LANGUAGE_ALIASES = {
  english: 'english', en: 'english', eng: 'english', 'en-us': 'english', 'tiếng anh': 'english', 'tieng anh': 'english',
  spanish: 'spanish', es: 'spanish', esp: 'spanish', 'es-es': 'spanish', 'tiếng tây ban nha': 'spanish', 'tieng tay ban nha': 'spanish',
  italian: 'italian', it: 'italian', ita: 'italian', 'it-it': 'italian', 'tiếng ý': 'italian', 'tieng y': 'italian',
  french: 'french', fr: 'french', fra: 'french', 'fr-fr': 'french', 'tiếng pháp': 'french', 'tieng phap': 'french',
}

export function normalizeLanguage(value, fallback = 'english') {
  if (!value) return fallback
  const key = String(value).trim().toLowerCase()
  return LANGUAGE_ALIASES[key] || (WORD_LANGUAGES.includes(key) ? key : fallback)
}
export const GENERIC_VIETNAMESE_DEFINITIONS = [
  'Một cách tuyệt đối hoặc vô điều kiện; hoàn toàn, tích cực, toàn bộ.',
  'Một câu cảm thán thông dụng trong tiếng Anh.',
  'Một công cụ xác định tiếng Anh phổ biến.',
  'Một đại từ tiếng Anh thông dụng.',
  'Một danh từ tiếng Anh thông dụng.',
  'Một động từ liên kết tiếng Anh phổ biến.',
  'Một động từ tiếng Anh thông dụng.',
  'Một giới từ tiếng Anh thông dụng.',
  'Một liên từ tiếng Anh thông dụng.',
  'Một số thứ tự tiếng Anh phổ biến.',
  'Một số tiếng Anh thông dụng.',
  'Một tính từ tiếng Anh thông dụng.',
  'Một trạng từ tiếng Anh thông dụng.',
]

function normalizeWord(word) {
  return String(word || '').trim().toLowerCase()
}

function splitList(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  return String(value || '')
    .split(/[,\n;]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `category-${Date.now()}`
}

export function wordRowFromForm(form) {
  return {
    word: String(form.word || '').trim(),
    type: WORD_TYPES.includes(form.type) ? form.type : 'other',
    ipa: String(form.ipa || '').trim() || null,
    vietnamese_definition: String(form.vietnamese_definition || '').trim(),
    example_sentence: String(form.example_sentence || '').trim() || null,
    root_word: String(form.root_word || '').trim() || null,
    family_words: splitList(form.family_words),
    synonyms: splitList(form.synonyms),
    antonyms: splitList(form.antonyms),
    category_id: form.category_id || null,
    level: LEVELS.includes(form.level) ? form.level : null,
    language: normalizeLanguage(form.language),
    source: form.source || 'manual',
  }
}

export async function getCurrentProfile() {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) return null

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listCategories() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('level', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listSentences({ query = '', topic = 'all', level = 'all', language = 'all', limit = 20, page = 1 } = {}) {
  const client = requireSupabase()
  const offset = (page - 1) * limit
  let request = client
    .from('sentences')
    .select('*')
    .order('language', { ascending: true })
    .order('level', { ascending: true, nullsFirst: false })
    .order('topic', { ascending: true, nullsFirst: false })
    .order('sentence', { ascending: true })
    .range(offset, offset + limit - 1)

  if (query.trim()) {
    const q = query.trim().replace(/[%_]/g, '\\$&')
    request = request.or(`sentence.ilike.%${q}%,vietnamese_translation.ilike.%${q}%,topic.ilike.%${q}%`)
  }
  if (topic !== 'all') request = request.eq('topic', topic || null)
  if (level !== 'all') request = request.eq('level', level)
  if (language !== 'all') request = request.eq('language', normalizeLanguage(language))

  const { data, error } = await request
  if (error) throw error
  return data || []
}

export async function listSentenceTopics() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('sentences')
    .select('topic')
    .not('topic', 'is', null)
  
  if (error) throw error
  const topics = [...new Set(data.map(d => String(d.topic).trim()))].sort((a, b) => a.localeCompare(b))
  return topics
}

export async function markSentenceLearned(sentenceId, learned = true) {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Authentication required.')
  const { error } = await client
    .from('user_sentence_progress')
    .upsert(
      { user_id: user.id, sentence_id: sentenceId, is_learned: learned },
      { onConflict: 'user_id,sentence_id' }
    )
  if (error) throw error
}

export async function listMySentenceProgress() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_sentence_progress')
    .select('is_learned,last_score,prosody_score,sentences(id,sentence)')
  if (error) throw error
  return data || []
}

export async function saveSentencePronunciationResult(sentenceId, result) {
  const client = requireSupabase()
  const score = Math.round(result?.overall ?? 0)
  const prosodyScore = Number.isFinite(Number(result?.prosodyScore))
    ? Math.round(Number(result.prosodyScore))
    : null
  const { data, error } = await client.rpc('mark_sentence_practiced', {
    p_sentence_id: sentenceId,
    p_score: score,
    p_prosody_score: prosodyScore,
    p_spoken_text: result?.spokenText || null,
    p_result: result || {},
  })
  if (error) throw error
  return data
}

export async function upsertCategory(input) {
  const client = requireSupabase()
  const row = {
    id: input.id || undefined,
    name: String(input.name || '').trim(),
    slug: String(input.slug || '').trim() || slugify(input.name),
    description: String(input.description || '').trim() || null,
    level: LEVELS.includes(input.level) ? input.level : null,
    parent_id: input.parent_id || null,
  }
  const { data, error } = await client.from('categories').upsert(row).select('*').single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const client = requireSupabase()
  const { error } = await client.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function listWords({ query = '', categoryId = 'all', level = 'all', language = 'all', missingIpa = false, genericDefinition = false, limit = 5000 } = {}) {
  const client = requireSupabase()
  let request = client
    .from('words')
    .select('*, categories(id,name,slug,level)')
    .order('word', { ascending: true })
    .limit(limit)

  if (missingIpa) {
    request = request.or('ipa.is.null,ipa.eq.')
  }
  if (genericDefinition) {
    request = request.in('vietnamese_definition', GENERIC_VIETNAMESE_DEFINITIONS)
  }
  if (!missingIpa && !genericDefinition && query.trim()) {
    const q = query.trim().replace(/[%_]/g, '\\$&')
    request = request.or(`word.ilike.%${q}%,vietnamese_definition.ilike.%${q}%,root_word.ilike.%${q}%`)
  }
  if (!missingIpa && !genericDefinition && categoryId !== 'all') request = request.eq('category_id', categoryId || null)
  if (!missingIpa && !genericDefinition && level !== 'all') request = request.eq('level', level)
  if (language && language !== 'all') request = request.eq('language', normalizeLanguage(language))

  const { data, error } = await request
  if (error) throw error
  return data || []
}

export async function fetchAllWords({ pageSize = 1000 } = {}) {
  const client = requireSupabase()
  const all = []
  let from = 0
  for (;;) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from('words')
      .select('*, categories(id,name,slug,level)')
      .order('word', { ascending: true })
      .range(from, to)
    if (error) throw error
    const batch = data || []
    all.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function setWordFlagged(id, flagged) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('words')
    .update({ flagged_incorrect: !!flagged })
    .eq('id', id)
    .select('*, categories(id,name,slug,level)')
    .single()
  if (error) throw error
  return data
}

export async function getWordByText(word, language = null) {
  const client = requireSupabase()
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) return null

  if (language) {
    const lang = normalizeLanguage(language)
    const { data, error } = await client
      .from('words')
      .select('*, categories(id,name,slug,level)')
      .eq('normalized_word', normalized)
      .eq('language', lang)
      .limit(1)
    if (error) throw error
    if (data?.[0]) return data[0]
  }

  const { data, error } = await client
    .from('words')
    .select('*, categories(id,name,slug,level)')
    .eq('normalized_word', normalized)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

export async function upsertWord(form) {
  const client = requireSupabase()
  const row = wordRowFromForm(form)
  if (!row.word) throw new Error('Word is required.')
  if (!row.vietnamese_definition) throw new Error('Vietnamese definition is required.')
  if (form.id) row.id = form.id

  const { data, error } = await client.from('words').upsert(row).select('*').single()
  if (error) throw error
  return data
}

export async function updateWordStudyFields(word, fields, language = null) {
  const client = requireSupabase()
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) throw new Error('Word is required.')
  const scopedLanguage = language || fields.language || null

  const payload = {
    vietnamese_definition: String(fields.vietnamese_definition || '').trim(),
    example_sentence: String(fields.example_sentence || '').trim() || null,
    root_word: String(fields.root_word || '').trim() || null,
    family_words: Array.isArray(fields.family_words) ? fields.family_words.map(String).map(v => v.trim()).filter(Boolean) : [],
    synonyms: Array.isArray(fields.synonyms) ? fields.synonyms.map(String).map(v => v.trim()).filter(Boolean) : [],
    antonyms: Array.isArray(fields.antonyms) ? fields.antonyms.map(String).map(v => v.trim()).filter(Boolean) : [],
  }
  if (!payload.vietnamese_definition) throw new Error('Vietnamese definition is required.')

  let request = client
    .from('words')
    .update(payload)
    .eq('normalized_word', normalized)
    .select('*, categories(id,name,slug,level)')
  if (scopedLanguage) request = request.eq('language', normalizeLanguage(scopedLanguage))
  const { data, error } = await request
  if (error) throw error
  if (!data?.length) throw new Error(`Không tìm thấy "${word}" trong Supabase.`)
  return data[0]
}

export const updateWordVietnameseDefinition = (word, vietnameseDefinition) =>
  updateWordStudyFields(word, { vietnamese_definition: vietnameseDefinition })

export async function updateWordIpa(word, ipa, language = null) {
  const client = requireSupabase()
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) throw new Error('Word is required.')
  const cleanIpa = String(ipa || '').trim()
  if (!cleanIpa) throw new Error('IPA is required.')

  let request = client
    .from('words')
    .update({ ipa: cleanIpa })
    .eq('normalized_word', normalized)
    .select('id, word, ipa, language')
  if (language) request = request.eq('language', normalizeLanguage(language))
  const { data, error } = await request
  if (error) throw error
  if (!data?.length) throw new Error(`Không tìm thấy "${word}" trong Supabase. Thêm từ trước khi cập nhật IPA.`)
  return data[0]
}

export async function deleteWord(id) {
  const client = requireSupabase()
  const { error } = await client.from('words').delete().eq('id', id)
  if (error) throw error
}

export async function deleteWordsBulk(ids) {
  const client = requireSupabase()
  if (!ids?.length) return
  const BATCH = 100
  for (let i = 0; i < ids.length; i += BATCH) {
    const { error } = await client.from('words').delete().in('id', ids.slice(i, i + BATCH))
    if (error) throw error
  }
}

export async function deleteSentencesBulk(ids) {
  const client = requireSupabase()
  if (!ids?.length) return
  const BATCH = 100
  for (let i = 0; i < ids.length; i += BATCH) {
    const { error } = await client.from('sentences').delete().in('id', ids.slice(i, i + BATCH))
    if (error) throw error
  }
}

export async function findOrCreateWord(word, meta = {}) {
  const client = requireSupabase()
  const normalized = normalizeWord(word)
  if (!normalized) throw new Error('Word is required.')

  const { data, error } = await client.rpc('get_or_create_word', {
    p_word: normalized,
    p_type: WORD_TYPES.includes(meta.type || meta.pos) ? (meta.type || meta.pos) : 'other',
    p_ipa: meta.ipa || null,
    p_vietnamese_definition: meta.meaning || meta.vietnamese_definition || 'Google Translate available',
    p_example_sentence: meta.example_sentence || null,
    p_level: LEVELS.includes(meta.level) ? meta.level : null,
    p_language: normalizeLanguage(meta.language),
    p_source: meta.source || 'app',
  })
  if (error) throw error
  return data
}

export async function listMyProgress() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_word_progress')
    .select('is_learned,last_score,ipa_status,words(id,word)')
  if (error) throw error
  return data || []
}

export async function setWordLearned(word, learned, score = null, meta = {}) {
  const client = requireSupabase()
  const wordRow = await findOrCreateWord(word, meta)
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Authentication required.')

  const payload = {
    user_id: user.id,
    word_id: wordRow.id,
    is_learned: Boolean(learned),
    learned_at: learned ? new Date().toISOString() : null,
  }
  if (Number.isFinite(score)) {
    payload.last_score = Math.round(score)
    payload.ipa_status = score >= 70 ? 'correct' : 'incorrect'
    payload.last_practiced_at = new Date().toISOString()
  }

  const { data, error } = await client
    .from('user_word_progress')
    .upsert(payload, { onConflict: 'user_id,word_id' })
    .select('*, words(word)')
    .single()
  if (error) throw error
  return data
}

export async function savePronunciationResult(word, result, meta = {}) {
  const client = requireSupabase()
  const score = Math.round(result?.overall ?? 0)
  const wordRow = await findOrCreateWord(word, meta)
  const { data, error } = await client.rpc('mark_word_practiced', {
    p_word_id: wordRow.id,
    p_score: score,
    p_spoken_word: result?.spokenWord || null,
    p_result: result || {},
  })
  if (error) throw error
  return data
}

export async function listProfiles() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data || []
}

export async function updateProfile(profile) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .update({
      full_name: profile.full_name || null,
      role: profile.role || 'student',
      is_active: Boolean(profile.is_active),
    })
    .eq('id', profile.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

function readImportRow(row, categories = []) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), value]))
  const categoryName = String(lower.category || lower['chủ đề'] || lower.topic || '').trim()
  const category = categoryName
    ? categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() || c.slug === slugify(categoryName))
    : null
  const rawLanguage = lower.language || lower['ngôn ngữ'] || lower['ngon ngu'] || lower.lang

  return {
    word: lower.word || lower['từ'] || lower.tu,
    type: lower.type || lower['loại từ'] || lower.pos,
    ipa: lower.ipa,
    vietnamese_definition: lower.vietnamese_definition || lower.meaning_vi || lower['nghĩa tiếng việt'] || lower.meaning,
    example_sentence: lower.example_sentence || lower.example || lower['ví dụ'],
    root_word: lower.root_word || lower.root || lower['từ gốc'],
    family_words: lower.family_words || lower.family || lower['family word'],
    synonyms: lower.synonyms || lower['từ đồng nghĩa'],
    antonyms: lower.antonyms || lower['từ trái nghĩa'],
    category_id: category?.id || null,
    categoryProvided: Boolean(categoryName),
    level: lower.level || lower['cấp độ'],
    language: normalizeLanguage(rawLanguage),
    languageProvided: Boolean(String(rawLanguage || '').trim()),
  }
}

export function mapImportedWordRow(row, categories = []) {
  const parsed = readImportRow(row, categories)
  return wordRowFromForm({
    ...parsed,
    type: parsed.type || 'other',
    source: 'excel',
  })
}

function hasValue(v) {
  if (Array.isArray(v)) return v.length > 0
  return v !== undefined && v !== null && String(v).trim() !== ''
}

function buildPartialUpdate(parsed) {
  const fields = {}
  const typeStr = String(parsed.type || '').trim()
  if (typeStr && WORD_TYPES.includes(typeStr)) fields.type = typeStr
  if (hasValue(parsed.ipa)) fields.ipa = String(parsed.ipa).trim()
  if (hasValue(parsed.vietnamese_definition)) fields.vietnamese_definition = String(parsed.vietnamese_definition).trim()
  if (hasValue(parsed.example_sentence)) fields.example_sentence = String(parsed.example_sentence).trim()
  if (hasValue(parsed.root_word)) fields.root_word = String(parsed.root_word).trim()
  if (hasValue(parsed.family_words)) fields.family_words = splitList(parsed.family_words)
  if (hasValue(parsed.synonyms)) fields.synonyms = splitList(parsed.synonyms)
  if (hasValue(parsed.antonyms)) fields.antonyms = splitList(parsed.antonyms)
  if (parsed.categoryProvided && parsed.category_id) fields.category_id = parsed.category_id
  const levelStr = String(parsed.level || '').trim()
  if (levelStr && LEVELS.includes(levelStr)) fields.level = levelStr
  if (parsed.languageProvided && WORD_LANGUAGES.includes(parsed.language)) {
    fields.language = parsed.language
  }
  return fields
}

export async function importWords(rows, categories = [], { onProgress } = {}) {
  const client = requireSupabase()
  const report = (event) => { try { onProgress?.(event) } catch {} }

  report({ phase: 'reading', current: 0, total: rows.length })

  const parsedRows = rows
    .map(row => readImportRow(row, categories))
    .filter(p => String(p.word || '').trim())
  if (parsedRows.length === 0) throw new Error('Không có dòng hợp lệ để import.')

  const dedupedByKey = new Map()
  for (const parsed of parsedRows) {
    const norm = String(parsed.word).trim().toLowerCase()
    const lang = normalizeLanguage(parsed.language)
    dedupedByKey.set(`${norm}|${lang}`, parsed)
  }
  const dedupedRows = [...dedupedByKey.values()]

  const normalizedWords = [...new Set(dedupedRows.map(p => String(p.word).trim().toLowerCase()))]
  report({ phase: 'fetching', current: 0, total: normalizedWords.length })
  const { data: existing, error: fetchErr } = await client
    .from('words')
    .select('id, normalized_word, language, created_at')
    .in('normalized_word', normalizedWords)
    .order('created_at', { ascending: true })
  if (fetchErr) throw fetchErr

  const existingIdByKey = new Map()
  for (const w of existing || []) {
    const key = `${w.normalized_word}|${w.language || 'english'}`
    if (!existingIdByKey.has(key)) {
      existingIdByKey.set(key, w.id)
    }
  }

  const toInsert = []
  const updateOps = []

  for (const parsed of dedupedRows) {
    const norm = String(parsed.word).trim().toLowerCase()
    const lang = normalizeLanguage(parsed.language)
    const existingId = existingIdByKey.get(`${norm}|${lang}`)

    if (existingId) {
      const fields = buildPartialUpdate(parsed)
      if (Object.keys(fields).length > 0) {
        updateOps.push({ id: existingId, fields })
      }
    } else {
      const insertRow = wordRowFromForm({
        ...parsed,
        type: parsed.type || 'other',
        source: 'excel',
      })
      if (insertRow.vietnamese_definition) {
        toInsert.push(insertRow)
      }
    }
  }

  const inserted = []
  const updated = []
  const totalWrites = toInsert.length + updateOps.length
  let processed = 0

  if (toInsert.length > 0) {
    report({ phase: 'inserting', current: processed, total: totalWrites })
    const { data, error } = await client.from('words').insert(toInsert).select('*')
    if (error) throw error
    inserted.push(...(data || []))
    processed += toInsert.length
    report({ phase: 'inserting', current: processed, total: totalWrites })
  }

  for (const op of updateOps) {
    const { data, error } = await client
      .from('words')
      .update(op.fields)
      .eq('id', op.id)
      .select('*')
      .single()
    if (error) throw error
    if (data) updated.push(data)
    processed += 1
    report({ phase: 'updating', current: processed, total: totalWrites })
  }

  report({ phase: 'done', current: totalWrites, total: totalWrites })
  return { inserted, updated, all: [...inserted, ...updated] }
}

function readSentenceImportRow(row) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), value]))
  const sentence = lower.sentence || lower.english_sentence || lower.english || lower.text || lower.cau || lower['cau tieng anh']
  const translation = lower.vietnamese_translation || lower.translation || lower.meaning_vi || lower.meaning || lower.vietnamese || lower['tieng viet']
  const level = String(lower.level || '').trim().toUpperCase()
  const rawLanguage = lower.language || lower.lang || lower['ngon ngu'] || lower['ngôn ngữ']

  return {
    sentence: String(sentence || '').trim(),
    vietnamese_translation: String(translation || '').trim(),
    topic: String(lower.topic || lower.category || lower.chu_de || lower['chu de'] || '').trim() || null,
    language: normalizeLanguage(rawLanguage),
    level: LEVELS.includes(level) ? level : null,
    source: String(lower.source || '').trim() || 'excel',
  }
}

export function mapImportedSentenceRow(row) {
  return readSentenceImportRow(row)
}

export async function importSentences(rows, { onProgress } = {}) {
  const client = requireSupabase()
  const report = (event) => { try { onProgress?.(event) } catch {} }

  report({ phase: 'reading', current: 0, total: rows.length })

  const parsedRows = rows
    .map(readSentenceImportRow)
    .filter(row => row.sentence)
  if (parsedRows.length === 0) throw new Error('Không có dòng câu hợp lệ để import.')

  const dedupedBySentence = new Map()
  for (const row of parsedRows) {
    dedupedBySentence.set(`${row.sentence.trim().toLowerCase()}|${row.language}`, row)
  }
  const dedupedRows = [...dedupedBySentence.values()]

  const { error: ensureTopicError } = await client.rpc('ensure_sentence_topic_column')
  if (ensureTopicError && !/function .*ensure_sentence_topic_column|Could not find the function/i.test(ensureTopicError.message || '')) {
    throw ensureTopicError
  }

  report({ phase: 'inserting', current: 0, total: dedupedRows.length })
  const { data, error } = await client
    .from('sentences')
    .upsert(dedupedRows, { onConflict: 'normalized_sentence,language' })
    .select('*')

  if (error) throw error
  report({ phase: 'done', current: dedupedRows.length, total: dedupedRows.length })
  return data || []
}

export function mapImportedCategoryRow(row) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), value]))
  const name = String(lower.name || lower['tên'] || lower.ten || '').trim()
  const slug = String(lower.slug || '').trim() || slugify(name)
  const levelRaw = String(lower.level || lower['cấp độ'] || lower['cap do'] || '').trim()
  return {
    name,
    slug,
    level: LEVELS.includes(levelRaw) ? levelRaw : null,
    description: String(lower.description || lower['mô tả'] || lower['mo ta'] || '').trim() || null,
  }
}

export async function importCategories(rows) {
  const client = requireSupabase()
  const mapped = rows.map(mapImportedCategoryRow).filter(row => row.name)
  if (mapped.length === 0) throw new Error('Không có dòng hợp lệ để import.')

  const { data, error } = await client
    .from('categories')
    .upsert(mapped, { onConflict: 'slug' })
    .select('*')
  if (error) throw error
  return data || []
}
