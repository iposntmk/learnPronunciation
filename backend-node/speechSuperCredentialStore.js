import { canUseSupabaseServiceClient, getSupabaseServiceClient } from './supabaseServer.js'

export const PROVIDER = 'speechsuper'

const MODES = new Set(['azure', 'speechsuper', 'both'])

export function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return MODES.has(mode) ? mode : 'azure'
}

export function statusFromRow(row) {
  return {
    id: row?.id || null,
    provider: PROVIDER,
    source: 'database',
    configured: Boolean(row?.app_key_ciphertext && row?.secret_key_ciphertext),
    appKeyConfigured: Boolean(row?.app_key_ciphertext),
    secretKeyConfigured: Boolean(row?.secret_key_ciphertext),
    userId: row?.user_id || 'guest',
    scoringMode: normalizeMode(row?.scoring_mode),
    expiresAt: row?.expires_at || null,
    isActive: row?.is_active !== false,
    lastTestedAt: row?.last_tested_at || null,
    lastTestOk: row?.last_test_ok ?? null,
    createdAt: row?.created_at || null,
    createdBy: row?.created_by || null,
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
    deactivatedAt: row?.deactivated_at || null,
    deactivatedBy: row?.deactivated_by || null,
  }
}

function historyFromRow(row) {
  const { configured, appKeyConfigured, secretKeyConfigured, ...history } = statusFromRow(row)
  return history
}

export function tableMissing(error) {
  const message = error?.message || ''
  return error?.code === '42P01'
    || (/provider_credentials/i.test(message) && /does not exist|schema cache/i.test(message) && /table|relation/i.test(message))
}

export function versionColumnsMissing(error) {
  return error?.code === '42703' || /is_active|created_by|deactivated|\bid\b/i.test(error?.message || '')
}

export async function fetchLegacyCredentialRow() {
  const { data, error } = await getSupabaseServiceClient()
    .from('provider_credentials')
    .select('*')
    .eq('provider', PROVIDER)
    .maybeSingle()
  if (tableMissing(error)) return null
  if (error) throw error
  return data
}

export async function fetchCredentialRow() {
  if (!canUseSupabaseServiceClient()) return null
  const { data, error } = await getSupabaseServiceClient()
    .from('provider_credentials')
    .select('*')
    .eq('provider', PROVIDER)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (tableMissing(error)) return null
  if (versionColumnsMissing(error)) return fetchLegacyCredentialRow()
  if (error) throw error
  return data
}

async function credentialHistory(limit = 10) {
  if (!canUseSupabaseServiceClient()) return []
  const { data, error } = await getSupabaseServiceClient()
    .from('provider_credentials')
    .select('id, provider, user_id, scoring_mode, expires_at, is_active, last_tested_at, last_test_ok, created_at, updated_at, created_by, updated_by, deactivated_at, deactivated_by')
    .eq('provider', PROVIDER)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (tableMissing(error)) return []
  if (versionColumnsMissing(error)) {
    const legacy = await fetchLegacyCredentialRow()
    return legacy ? [historyFromRow(legacy)] : []
  }
  if (error) throw error
  return (data || []).map(historyFromRow)
}

export async function appendHistory(status, includeHistory) {
  return includeHistory ? { ...status, history: await credentialHistory() } : status
}

export async function reactivateCredential(service, row, updatedBy) {
  if (!row?.id) return
  await service
    .from('provider_credentials')
    .update({ is_active: true, deactivated_at: null, deactivated_by: null, updated_by: updatedBy })
    .eq('id', row.id)
}

export async function updateLegacyCredential(service, next) {
  const { is_active, created_by, deactivated_at, deactivated_by, ...legacyNext } = next
  const { data, error } = await service
    .from('provider_credentials')
    .upsert(legacyNext, { onConflict: 'provider' })
    .select('*')
    .single()
  if (error) throw error
  return data
}
