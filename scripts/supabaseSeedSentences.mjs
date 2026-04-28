import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { ENGLISH_SPEAKING_GUIDE_SENTENCES } from './englishSpeakingGuideSentences.mjs'

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

function buildRows() {
  return ENGLISH_SPEAKING_GUIDE_SENTENCES.map(item => ({
    sentence: item.sentence,
    language: item.language || 'english',
    vietnamese_translation: item.translation,
    topic: item.topic,
    level: item.level,
    source: 'english-speaking-guide',
  }))
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

  const { data, error } = await client
    .from('sentences')
    .select('id,sentence,language,topic,level')
    .limit(5)

  result.sentences = error
    ? { ok: false, error: error.message }
    : { ok: true, count: data.length, sample: data.map(item => item.sentence).join(' | ') }

  return result
}

async function seedSentences(client) {
  const rows = buildRows()
  const chunkSize = 50
  let total = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await client
      .from('sentences')
      .upsert(chunk, { onConflict: 'normalized_sentence,language' })
      .select('id')

    if (error) throw new Error(`Sentence seed failed at rows ${i + 1}-${i + chunk.length}: ${error.message}`)
    total += data?.length || chunk.length
    console.log(`Seeded ${Math.min(i + chunk.length, rows.length)}/${rows.length} sentences`)
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
  const result = await seedSentences(client)
  console.log(`Done. Upserted ${result.total} speaking-guide sentences.`)
}
