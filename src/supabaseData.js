import { requireSupabase } from './supabaseClient.js'

export const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

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

export async function listWords({ query = '', categoryId = 'all', level = 'all', limit = 5000 } = {}) {
  const client = requireSupabase()
  let request = client
    .from('words')
    .select('*, categories(id,name,slug,level)')
    .order('word', { ascending: true })
    .limit(limit)

  if (query.trim()) {
    const q = query.trim().replace(/[%_]/g, '\\$&')
    request = request.or(`word.ilike.%${q}%,vietnamese_definition.ilike.%${q}%,root_word.ilike.%${q}%`)
  }
  if (categoryId !== 'all') request = request.eq('category_id', categoryId || null)
  if (level !== 'all') request = request.eq('level', level)

  const { data, error } = await request
  if (error) throw error
  return data || []
}

export async function getWordByText(word) {
  const client = requireSupabase()
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await client
    .from('words')
    .select('*, categories(id,name,slug,level)')
    .eq('normalized_word', normalized)
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

export async function deleteWord(id) {
  const client = requireSupabase()
  const { error } = await client.from('words').delete().eq('id', id)
  if (error) throw error
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

export function mapImportedWordRow(row, categories = []) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim().toLowerCase(), value]))
  const categoryName = String(lower.category || lower['chủ đề'] || lower.topic || '').trim()
  const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() || c.slug === slugify(categoryName))

  return wordRowFromForm({
    word: lower.word || lower['từ'] || lower.tu,
    type: lower.type || lower['loại từ'] || lower.pos || 'other',
    ipa: lower.ipa,
    vietnamese_definition: lower.vietnamese_definition || lower.meaning_vi || lower['nghĩa tiếng việt'] || lower.meaning,
    example_sentence: lower.example_sentence || lower.example || lower['ví dụ'],
    root_word: lower.root_word || lower.root || lower['từ gốc'],
    family_words: lower.family_words || lower.family || lower['family word'],
    synonyms: lower.synonyms || lower['từ đồng nghĩa'],
    antonyms: lower.antonyms || lower['từ trái nghĩa'],
    category_id: category?.id || null,
    level: lower.level || lower['cấp độ'],
    source: 'excel',
  })
}

export async function importWords(rows, categories = []) {
  const client = requireSupabase()
  const mapped = rows.map(row => mapImportedWordRow(row, categories)).filter(row => row.word && row.vietnamese_definition)
  if (mapped.length === 0) throw new Error('Không có dòng hợp lệ để import.')

  const { data, error } = await client
    .from('words')
    .upsert(mapped, { onConflict: 'normalized_word,category_key' })
    .select('*')
  if (error) throw error
  return data || []
}
