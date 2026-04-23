import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'

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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL/key in env.')
}

const pdfPath = process.argv.find(arg => arg.toLowerCase().endsWith('.pdf')) || 'C:/Users/Admin/Desktop/3000.pdf'
const dryRun = process.argv.includes('--dry-run')

function isRowStart(line) {
  return /^\s*\d+\s+/.test(line)
}

function normalizeWord(word) {
  return String(word || '').trim().toLowerCase()
}

function cleanLine(line) {
  return String(line || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeHeader(line) {
  const lower = line.toLowerCase()
  return lower.includes('oxford 3000')
    || lower.includes('http://www.effortlessenglishclub.edu.vn')
    || lower.includes('no.') && lower.includes('word') && lower.includes('meaning')
    || /^--\s*\d+\s+of\s+\d+\s*--$/i.test(lower)
    || lower === '`'
}

function looksLikePronounce(value) {
  if (!value) return false
  const v = value.trim()
  if (!v) return false
  // IPA/translit in this PDF often contains apostrophes, colons or many non-ascii letters.
  return /[':,]/.test(v) || /[^\x00-\x7F]/.test(v)
}

function parseRows(rawText) {
  const lines = rawText.split(/\r?\n/)
  const rows = []
  let current = null
  let pendingNumber = null

  const flush = () => {
    if (!current) return
    current.word = normalizeWord(current.word)
    current.pronounce = cleanLine(current.pronounce)
    current.meaning = cleanLine(current.meaning)
    if (current.word) rows.push(current)
    current = null
  }

  for (const raw of lines) {
    const line = raw.replace(/\u0000/g, '').trim()
    if (!line) continue
    if (looksLikeHeader(line)) continue

    // Some pages split the row number onto its own line, followed by the row content.
    if (/^\d+$/.test(line)) {
      pendingNumber = Number(line)
      continue
    }

    const rowRaw = pendingNumber ? `${pendingNumber} ${raw}` : raw
    const rowLine = pendingNumber ? `${pendingNumber} ${line}` : line
    pendingNumber = null

    if (isRowStart(rowLine)) {
      flush()
      const parts = rowRaw.split('\t').map(p => p.trim()).filter(Boolean)
      if (parts.length === 0) continue

      const first = parts[0]
      const firstMatch = first.match(/^(\d+)\s+(.+)$/)
      if (!firstMatch) continue
      const number = Number(firstMatch[1])
      const word = firstMatch[2].trim()
      const cols = parts.slice(1)

      let type = ''
      let pronounce = ''
      let meaning = ''

      if (cols.length >= 3) {
        type = cols[0]
        pronounce = cols[1]
        meaning = cols.slice(2).join(' ')
      } else if (cols.length === 2) {
        type = cols[0]
        if (looksLikePronounce(cols[1])) pronounce = cols[1]
        else meaning = cols[1]
      } else if (cols.length === 1) {
        if (looksLikePronounce(cols[0])) pronounce = cols[0]
        else meaning = cols[0]
      }

      current = { number, word, type, pronounce, meaning }
      continue
    }

    if (!current) continue
    // Continuation line, mostly wrapped meaning.
    current.meaning = `${current.meaning} ${line}`.trim()
  }

  flush()
  return rows
}

async function extractPdfText(inputPath) {
  const data = fs.readFileSync(inputPath)
  const parser = new PDFParse({ data })
  const result = await parser.getText()
  await parser.destroy()
  return result.text || ''
}

function pickUpdates(dbWords, parsedRows) {
  const byWord = new Map(parsedRows.map(row => [normalizeWord(row.word), row]))
  const updates = []
  for (const item of dbWords) {
    const key = normalizeWord(item.word)
    const row = byWord.get(key)
    if (!row) continue
    const nextIpa = row.pronounce || item.ipa || null
    const nextMeaning = row.meaning || item.vietnamese_definition || ''
    const ipaChanged = (item.ipa || '') !== (nextIpa || '')
    const meaningChanged = (item.vietnamese_definition || '') !== (nextMeaning || '')
    if (!ipaChanged && !meaningChanged) continue
    updates.push({
      id: item.id,
      word: item.word, // required for upsert because "word" is NOT NULL
      ipa: nextIpa,
      vietnamese_definition: nextMeaning || '',
    })
  }
  return updates
}

async function main() {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const pdfText = await extractPdfText(pdfPath)
  const parsedRows = parseRows(pdfText)

  const pageSize = 1000
  const words = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('words')
      .select('id,word,ipa,vietnamese_definition')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    words.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  const updates = pickUpdates(words || [], parsedRows)
  console.log(JSON.stringify({
    pdfPath,
    parsedRows: parsedRows.length,
    dbWords: words?.length || 0,
    updates: updates.length,
    dryRun,
  }, null, 2))

  if (updates.length === 0 || dryRun) return

  const chunk = 500
  let done = 0
  for (let i = 0; i < updates.length; i += chunk) {
    const batch = updates.slice(i, i + chunk)
    const { error } = await client
      .from('words')
      .upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`Update failed at ${i + 1}-${i + batch.length}: ${error.message}`)
    done += batch.length
    console.log(`Updated ${done}/${updates.length}`)
  }
}

main().catch(err => {
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
})
