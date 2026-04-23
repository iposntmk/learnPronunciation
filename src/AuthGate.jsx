import React, { useEffect, useState } from 'react'
import { LogIn } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabaseClient.js'
import { getCurrentProfile } from './supabaseData.js'

function authRedirectUrl() {
  return `${window.location.origin}/learnPronunciation/`
}

function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-[#111827] to-[#0f0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        try { setProfile(await getCurrentProfile()) } catch (err) { setMessage(err.message) }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
      else getCurrentProfile().then(setProfile).catch(err => setMessage(err.message))
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName },
            emailRedirectTo: authRedirectUrl(),
          },
        })
        if (error) throw error
        setMessage('Đã tạo tài khoản. Nếu Supabase bật xác minh email, hãy kiểm tra email trước khi đăng nhập.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
      }
    } catch (err) {
      setMessage(err.message)
    }
  }

  const signInWithGoogle = async () => {
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    })
    if (error) {
      const unsupportedProvider = error.message?.toLowerCase().includes('unsupported provider')
      setMessage(unsupportedProvider ? 'Google login chưa được bật trong Supabase Auth Providers.' : error.message)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthShell>
        <h1 className="text-white text-2xl font-bold mb-2">Cần cấu hình Supabase</h1>
        <p className="text-white/60 text-sm leading-relaxed">
          Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào `.env.local`, chạy SQL schema, rồi restart `npm run dev`.
        </p>
      </AuthShell>
    )
  }

  if (loading) {
    return (
      <AuthShell>
        <div className="text-white/70 text-sm">Đang kiểm tra đăng nhập...</div>
      </AuthShell>
    )
  }

  if (session && profile?.is_active === false) {
    return (
      <AuthShell>
        <h1 className="text-white text-xl font-bold mb-2">Tài khoản bị khóa</h1>
        <p className="text-white/60 text-sm mb-4">Liên hệ admin để kích hoạt lại tài khoản.</p>
        <button onClick={() => supabase.auth.signOut()} className="w-full rounded-xl bg-white text-gray-950 font-semibold py-3">Đăng xuất</button>
      </AuthShell>
    )
  }

  if (session) return children({ session, profile, setProfile })

  return (
    <AuthShell>
      <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center mb-4">
        <LogIn className="text-emerald-200" size={24} />
      </div>
      <h1 className="text-white text-2xl font-bold">{mode === 'signup' ? 'Đăng ký' : 'Đăng nhập'}</h1>
      <p className="text-white/50 text-sm mt-1 mb-4">Bạn cần đăng nhập để dùng app và đồng bộ tiến độ học.</p>

      <form onSubmit={submit} className="grid gap-3">
        {mode === 'signup' && (
          <input
            value={form.fullName}
            onChange={e => setForm({ ...form, fullName: e.target.value })}
            placeholder="Tên hiển thị"
            className="rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-white outline-none focus:border-emerald-300"
          />
        )}
        <input
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          type="email"
          placeholder="Email"
          required
          className="rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-white outline-none focus:border-emerald-300"
        />
        <input
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-white outline-none focus:border-emerald-300"
        />
        <button className="rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">
          {mode === 'signup' ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>

      <button onClick={signInWithGoogle} className="mt-3 w-full rounded-xl bg-white text-gray-950 font-semibold py-3">
        Đăng nhập bằng Google
      </button>

      <button
        onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage('') }}
        className="mt-4 text-white/60 text-sm underline underline-offset-4"
      >
        {mode === 'signup' ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
      </button>

      {message && <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-yellow-100 text-sm">{message}</div>}
    </AuthShell>
  )
}
