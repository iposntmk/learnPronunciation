import { createClient } from '@supabase/supabase-js'

let authClient = null
let serviceClient = null

function supabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
}

function anonKey() {
  return (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
}

function serviceRoleKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}

export function getSupabaseAuthClient() {
  const url = supabaseUrl()
  const key = anonKey()
  if (!url || !key) throw new Error('Supabase URL/anon key is missing.')
  if (!authClient) {
    authClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return authClient
}

export function getSupabaseServiceClient() {
  const url = supabaseUrl()
  const key = serviceRoleKey()
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.')
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serviceClient
}

export function canUseSupabaseServiceClient() {
  return Boolean(supabaseUrl() && serviceRoleKey())
}
