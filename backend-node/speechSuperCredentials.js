import { getSupabaseServiceClient } from './supabaseServer.js'
import { sendSpeechSuperRequest } from './speechSuperApi.js'
import { decryptSecret, encryptSecret } from './secretCrypto.js'
import {
  PROVIDER,
  appendHistory,
  fetchCredentialRow,
  normalizeMode,
  reactivateCredential,
  statusFromRow,
  updateLegacyCredential,
  versionColumnsMissing,
} from './speechSuperCredentialStore.js'

const CREDENTIAL_CACHE_MS = 5 * 60 * 1000

let credentialCache = { expiresAt: 0, value: null }

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

export async function getSpeechSuperCredentialStatus({ includeEnvFallback = true, includeHistory = false } = {}) {
  const row = await fetchCredentialRow()
  if (row) return appendHistory(statusFromRow(row), includeHistory)
  if (includeEnvFallback) {
    const env = envCredential()
    return appendHistory({ ...env, appKey: undefined, secretKey: undefined }, includeHistory)
  }
  return appendHistory({
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
  }, includeHistory)
}

export function clearSpeechSuperCredentialCache() {
  credentialCache = { expiresAt: 0, value: null }
}

export async function resolveSpeechSuperCredential({ forceRefresh = false } = {}) {
  if (!forceRefresh && credentialCache.value && Date.now() < credentialCache.expiresAt) {
    return credentialCache.value
  }

  const row = await fetchCredentialRow()
  const credential = row
    ? {
        ...statusFromRow(row),
        appKey: decryptSecret(row.app_key_ciphertext),
        secretKey: decryptSecret(row.secret_key_ciphertext),
      }
    : envCredential()

  credential.configured = Boolean(credential.appKey && credential.secretKey)
  credentialCache = { value: credential, expiresAt: Date.now() + CREDENTIAL_CACHE_MS }
  return credential
}

function normalizeExpiresAt(value) {
  if (value == null || String(value).trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid expiry date.')
  return date.toISOString()
}

function trimmed(value) {
  return String(value || '').trim()
}

function buildCredentialRow({ appKey, secretKey, userId, scoringMode, expiresAt, existing, updatedBy }) {
  const env = envCredential()
  return {
    provider: PROVIDER,
    app_key_ciphertext: trimmed(appKey)
      ? encryptSecret(trimmed(appKey))
      : existing?.app_key_ciphertext || (env.appKey ? encryptSecret(env.appKey) : null),
    secret_key_ciphertext: trimmed(secretKey)
      ? encryptSecret(trimmed(secretKey))
      : existing?.secret_key_ciphertext || (env.secretKey ? encryptSecret(env.secretKey) : null),
    user_id: String(userId || existing?.user_id || 'guest').trim() || 'guest',
    scoring_mode: normalizeMode(scoringMode || existing?.scoring_mode),
    expires_at: normalizeExpiresAt(expiresAt),
    is_active: true,
    created_by: updatedBy,
    updated_by: updatedBy,
  }
}

export async function updateSpeechSuperCredential({
  appKey,
  secretKey,
  userId,
  scoringMode,
  expiresAt,
  updatedBy,
  includeHistory = false,
}) {
  const service = getSupabaseServiceClient()
  const existing = await fetchCredentialRow()
  const next = buildCredentialRow({ appKey, secretKey, userId, scoringMode, expiresAt, existing, updatedBy })

  if (existing && !existing.id) {
    const row = await updateLegacyCredential(service, next)
    clearSpeechSuperCredentialCache()
    return appendHistory(statusFromRow(row), includeHistory)
  }

  if (existing?.id) {
    const { error } = await service
      .from('provider_credentials')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: updatedBy,
        updated_by: updatedBy,
      })
      .eq('id', existing.id)
    if (error) throw error
  }

  const { data, error } = await service.from('provider_credentials').insert(next).select('*').single()
  if (error) {
    await reactivateCredential(service, existing, updatedBy)
    if (versionColumnsMissing(error)) {
      const row = await updateLegacyCredential(service, next)
      clearSpeechSuperCredentialCache()
      return appendHistory(statusFromRow(row), includeHistory)
    }
    throw error
  }

  clearSpeechSuperCredentialCache()
  return appendHistory(statusFromRow(data), includeHistory)
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
    const query = getSupabaseServiceClient()
      .from('provider_credentials')
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok, updated_by: updatedBy })
    const { error } = row.id ? await query.eq('id', row.id) : await query.eq('provider', PROVIDER)
    if (error) throw error
  }

  return { ok, detail, status: await getSpeechSuperCredentialStatus({ includeHistory: true }) }
}
