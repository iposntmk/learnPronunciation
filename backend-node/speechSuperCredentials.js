import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { canUseSupabaseServiceClient, getSupabaseServiceClient } from './supabaseServer.js'
import { sendSpeechSuperRequest } from './speechSuperApi.js'

const PROVIDER = 'speechsuper'
const MODES = new Set(['azure', 'speechsuper', 'both'])

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return MODES.has(mode) ? mode : 'azure'
}

function envCredential() {
  const appKey = (process.env.SPEECHSUPER_APP_KEY || '').trim()
  const secretKey = (process.env.SPEECHSUPER_SECRET_KEY || '').trim()
  return {
    provider: PROVIDER,
    source: 'env',
    configured: Boolean(appKey && secretKey),
    appKeyConfigured: Boolean(appKey),
    secretKeyConfigured: Boolean(secretKey),
    appKey,
    secretKey,
    userId: (process.env.SPEECHSUPER_USER_ID || 'guest').trim() || 'guest',
    scoringMode: normalizeMode(process.env.SCORING_MODE),
    expiresAt: null,
    lastTestedAt: null,
    lastTestOk: null,
  }
}

function encryptionKey() {
  const value = (process.env.CREDENTIAL_ENCRYPTION_KEY || '').trim()
  if (!value) throw new Error('CREDENTIAL_ENCRYPTION_KEY is missing.')
  return createHash('sha256').update(value).digest()
}

function encryptSecret(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  })
}

function decryptSecret(ciphertext) {
  if (!ciphertext) return ''
  const payload = JSON.parse(ciphertext)
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

function statusFromRow(row) {
  return {
    provider: PROVIDER,
    source: 'database',
    configured: Boolean(row?.app_key_ciphertext && row?.secret_key_ciphertext),
    appKeyConfigured: Boolean(row?.app_key_ciphertext),
    secretKeyConfigured: Boolean(row?.secret_key_ciphertext),
    userId: row?.user_id || 'guest',
    scoringMode: normalizeMode(row?.scoring_mode),
    expiresAt: row?.expires_at || null,
    lastTestedAt: row?.last_tested_at || null,
    lastTestOk: row?.last_test_ok ?? null,
    updatedAt: row?.updated_at || null,
  }
}

async function fetchCredentialRow() {
  if (!canUseSupabaseServiceClient()) return null
  const { data, error } = await getSupabaseServiceClient()
    .from('provider_credentials')
    .select('*')
    .eq('provider', PROVIDER)
    .maybeSingle()
  if (error?.code === '42P01' || /provider_credentials/i.test(error?.message || '')) return null
  if (error) throw error
  return data
}

export async function getSpeechSuperCredentialStatus({ includeEnvFallback = true } = {}) {
  const row = await fetchCredentialRow()
  if (row) return statusFromRow(row)
  if (includeEnvFallback) {
    const env = envCredential()
    return { ...env, appKey: undefined, secretKey: undefined }
  }
  return {
    provider: PROVIDER,
    source: 'database',
    configured: false,
    appKeyConfigured: false,
    secretKeyConfigured: false,
    userId: 'guest',
    scoringMode: 'azure',
    expiresAt: null,
    lastTestedAt: null,
    lastTestOk: null,
  }
}

export async function resolveSpeechSuperCredential() {
  const row = await fetchCredentialRow()
  if (!row) return envCredential()
  const appKey = decryptSecret(row.app_key_ciphertext)
  const secretKey = decryptSecret(row.secret_key_ciphertext)
  return {
    ...statusFromRow(row),
    appKey,
    secretKey,
    configured: Boolean(appKey && secretKey),
  }
}

function normalizeExpiresAt(value) {
  if (value == null || String(value).trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid expiry date.')
  return date.toISOString()
}

export async function updateSpeechSuperCredential({ appKey, secretKey, userId, scoringMode, expiresAt, updatedBy }) {
  const service = getSupabaseServiceClient()
  const existing = await fetchCredentialRow()
  const env = envCredential()
  const next = {
    provider: PROVIDER,
    app_key_ciphertext: String(appKey || '').trim()
      ? encryptSecret(appKey.trim())
      : existing?.app_key_ciphertext || (env.appKey ? encryptSecret(env.appKey) : null),
    secret_key_ciphertext: String(secretKey || '').trim()
      ? encryptSecret(secretKey.trim())
      : existing?.secret_key_ciphertext || (env.secretKey ? encryptSecret(env.secretKey) : null),
    user_id: String(userId || existing?.user_id || 'guest').trim() || 'guest',
    scoring_mode: normalizeMode(scoringMode || existing?.scoring_mode),
    expires_at: normalizeExpiresAt(expiresAt),
    updated_by: updatedBy,
  }
  const { data, error } = await service
    .from('provider_credentials')
    .upsert(next, { onConflict: 'provider' })
    .select('*')
    .single()
  if (error) throw error
  return statusFromRow(data)
}

function silenceWav() {
  const sampleRate = 16000
  const samples = sampleRate
  const dataSize = samples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

async function credentialForTest(payload) {
  const current = await resolveSpeechSuperCredential()
  return {
    ...current,
    appKey: String(payload.appKey || '').trim() || current.appKey,
    secretKey: String(payload.secretKey || '').trim() || current.secretKey,
    userId: String(payload.userId || '').trim() || current.userId || 'guest',
  }
}

function speechSuperErrorDetail(rawText) {
  try {
    const payload = JSON.parse(rawText)
    const error = payload?.error || payload?.err || payload?.err_msg || payload?.message
    if (!error) return ''
    return typeof error === 'string' ? error : JSON.stringify(error).slice(0, 160)
  } catch {
    return ''
  }
}

export async function testSpeechSuperCredential(payload = {}, updatedBy = null) {
  const credential = await credentialForTest(payload)
  if (!credential.appKey || !credential.secretKey) throw new Error('SpeechSuper appKey/secretKey is missing.')

  let ok = false
  let detail = ''
  try {
    const { response, rawText } = await sendSpeechSuperRequest({
      ...credential,
      text: 'test',
      audio: { filename: 'test.wav', type: 'audio/wav', content: silenceWav() },
      timeoutMs: 12000,
    })
    const payloadError = response.ok ? speechSuperErrorDetail(rawText) : ''
    ok = response.ok && !payloadError
    detail = ok ? 'SpeechSuper responded.' : `SpeechSuper API error ${response.status}: ${(payloadError || rawText).slice(0, 160)}`
  } catch (err) {
    detail = err.name === 'AbortError' ? 'SpeechSuper request timed out.' : err.message
  }

  const row = await fetchCredentialRow()
  if (row) {
    const { error } = await getSupabaseServiceClient()
      .from('provider_credentials')
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok, updated_by: updatedBy })
      .eq('provider', PROVIDER)
    if (error) throw error
  }

  return { ok, detail, status: await getSpeechSuperCredentialStatus() }
}
