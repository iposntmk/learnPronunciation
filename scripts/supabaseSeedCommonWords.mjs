import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { COMMON_3000_WORDS } from '../src/commonWords.js'
import { COMMON_3000_DETAIL_MAP } from '../src/commonWordDetails.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
        return [key, value]
      })
  )
}

const fileEnv = {
  ...loadEnvFile(path.join(rootDir, '.env')),
  ...loadEnvFile(path.join(rootDir, '.env.local')),
}

const env = { ...fileEnv, ...process.env }
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY
const email = env.SUPABASE_EMAIL
const password = env.SUPABASE_PASSWORD

if (!supabaseUrl || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local.')
}

function mapWordType(pos = '') {
  const value = String(pos).toLowerCase()
  if (value.includes('noun')) return 'noun'
  if (value.includes('verb')) return 'verb'
  if (value.includes('adjective')) return 'adjective'
  if (value.includes('adverb')) return 'adverb'
  if (value.includes('phrase') || value.includes('idiom')) return 'phrase'
  return 'other'
}

function bestMeaning(detail, fallbackPos) {
  const meanings = Array.isArray(detail?.meanings) ? detail.meanings : []
  const byPos = meanings.find(item => item.pos && fallbackPos && fallbackPos.toLowerCase().includes(String(item.pos).toLowerCase()))
  return byPos || meanings.find(item => item.pos !== 'translate') || meanings[0] || null
}

function buildRows(categories) {
  const categoryByLevel = new Map(categories.filter(c => c.level).map(c => [c.level, c.id]))
  return COMMON_3000_WORDS.map(entry => {
    const detail = COMMON_3000_DETAIL_MAP[entry.word.toLowerCase()]
    const meaning = bestMeaning(detail, entry.pos)
    return {
      word: entry.word,
      type: mapWordType(entry.pos),
      ipa: null,
      vietnamese_definition: meaning?.meaningVi || `${entry.level} ${entry.pos}`,
      example_sentence: meaning?.exampleEn || null,
      root_word: null,
      family_words: [],
      synonyms: [],
      antonyms: [],
      category_id: categoryByLevel.get(entry.level) || null,
      level: entry.level,
      source: 'common-3000',
    }
  })
}

async function ensureDefaultCategories(client) {
  const defaults = [
    { name: 'A1 Core', slug: 'a1-core', description: 'Starter vocabulary', level: 'A1' },
    { name: 'A2 Core', slug: 'a2-core', description: 'Elementary vocabulary', level: 'A2' },
    { name: 'B1 Core', slug: 'b1-core', description: 'Intermediate vocabulary', level: 'B1' },
    { name: 'B2 Core', slug: 'b2-core', description: 'Upper intermediate vocabulary', level: 'B2' },
    { name: 'Health', slug: 'health', description: 'Health and body vocabulary', level: null },
    { name: 'History', slug: 'history', description: 'History and culture vocabulary', level: null },
  ]

  const { error } = await client
    .from('categories')
    .upsert(defaults, { onConflict: 'slug' })
  if (error) throw new Error(`Default category seed failed: ${error.message}`)
}

async function createClientWithAuth() {
  const key = serviceRoleKey || publishableKey
  const client = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (!serviceRoleKey && email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Admin sign-in failed: ${error.message}`)
  }

  return client
}

async function checkConnection(client) {
  const result = {
    url: supabaseUrl,
    usingServiceRole: Boolean(serviceRoleKey),
    usingEmailPassword: Boolean(!serviceRoleKey && email && password),
  }

  const { data: categories, error: categoriesError } = await client
    .from('categories')
    .select('id,name,slug,level')
    .limit(10)

  result.categories = categoriesError
    ? { ok: false, error: categoriesError.message }
    : { ok: true, count: categories.length, sample: categories.map(c => c.slug).join(', ') }

  const { data: words, error: wordsError } = await client
    .from('words')
    .select('id,word,level')
    .limit(5)

  result.words = wordsError
    ? { ok: false, error: wordsError.message }
    : { ok: true, count: words.length, sample: words.map(w => w.word).join(', ') }

  return result
}

async function seedCommonWords(client) {
  await ensureDefaultCategories(client)

  const { data: categories, error: categoriesError } = await client
    .from('categories')
    .select('id,name,slug,level')
  if (categoriesError) throw categoriesError

  const rows = buildRows(categories || [])
  const chunkSize = 500
  let total = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await client
      .from('words')
      .upsert(chunk, { onConflict: 'normalized_word,category_key' })
      .select('id')

    if (error) throw new Error(`Seed failed at rows ${i + 1}-${i + chunk.length}: ${error.message}`)
    total += data?.length || chunk.length
    console.log(`Seeded ${Math.min(i + chunk.length, rows.length)}/${rows.length}`)
  }

  return { total }
}

const mode = process.argv.includes('--check') ? 'check' : 'seed'
const client = await createClientWithAuth()
const check = await checkConnection(client)
console.log(JSON.stringify(check, null, 2))

if (mode === 'seed') {
  const canWrite = serviceRoleKey || (email && password)
  if (!canWrite) {
    throw new Error('Seed requires SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_EMAIL and SUPABASE_PASSWORD for an admin account.')
  }
  const result = await seedCommonWords(client)
  console.log(`Done. Upserted ${result.total} common words.`)
}
