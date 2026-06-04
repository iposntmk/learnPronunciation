import { getSupabaseAuthClient, getSupabaseServiceClient } from './supabaseServer.js'

export function bearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || ''
  const match = String(value).match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export async function requireAdmin(req) {
  const token = bearerToken(req)
  if (!token) return { error: { status: 401, detail: 'Missing Supabase access token.' } }

  const auth = getSupabaseAuthClient()
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData?.user) return { error: { status: 401, detail: 'Invalid Supabase access token.' } }

  const service = getSupabaseServiceClient()
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError) throw profileError
  if (profile?.role !== 'admin' || profile?.is_active !== true) {
    return { error: { status: 403, detail: 'Admin role required.' } }
  }

  return { user: authData.user, profile, service }
}
