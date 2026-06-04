import React, { useEffect, useState } from 'react'
import { FlaskConical, KeyRound, RefreshCw, Save } from 'lucide-react'
import { supabase } from '../../supabaseClient.js'
import SpeechSuperCredentialHistory from './SpeechSuperCredentialHistory.jsx'

const emptyForm = {
  appKey: '',
  secretKey: '',
  userId: 'guest',
  scoringMode: 'azure',
  expiresAt: '',
}

function inputClass() {
  return 'w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-white outline-none focus:border-emerald-300'
}

function apiUrl(route) {
  const proxyUrl = import.meta.env?.VITE_SPEECHSUPER_PROXY_URL || '/api/speechsuper/pronunciation'
  return `${String(proxyUrl).replace(/\/pronunciation\/?$/i, '')}/${route}`
}

function dateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function yesNo(value) {
  return value ? 'yes' : 'no'
}

function StatusCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950/35 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

async function fetchJsonWithAuth(route, options = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Missing Supabase session.')
  const response = await fetch(apiUrl(route), {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`)
  return payload
}

export default function SpeechSuperApiKeysPanel() {
  const [status, setStatus] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    setMessage('')
    try {
      const next = await fetchJsonWithAuth('config')
      setStatus(next)
      setForm(current => ({
        ...current,
        appKey: '',
        secretKey: '',
        userId: next.userId || 'guest',
        scoringMode: next.scoringMode || 'azure',
        expiresAt: dateInputValue(next.expiresAt),
      }))
    } catch (err) {
      setMessage(`Load failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const payload = () => ({
    appKey: form.appKey,
    secretKey: form.secretKey,
    userId: form.userId,
    scoringMode: form.scoringMode,
    expiresAt: form.expiresAt ? `${form.expiresAt}T00:00:00.000Z` : null,
  })

  const save = async event => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const next = await fetchJsonWithAuth('config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      setStatus(next)
      setForm(current => ({ ...current, appKey: '', secretKey: '', expiresAt: dateInputValue(next.expiresAt) }))
      setMessage('Saved SpeechSuper API key settings.')
    } catch (err) {
      setMessage(`Save failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const test = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await fetchJsonWithAuth('test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      setStatus(result.status)
      setMessage(result.ok ? 'SpeechSuper test succeeded.' : `SpeechSuper test failed: ${result.detail}`)
    } catch (err) {
      setMessage(`Test failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 grid gap-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <KeyRound size={18} /> SpeechSuper
            </h2>
            <p className="mt-1 text-xs text-white/45">Blank key fields keep the current encrypted values.</p>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard label="configured" value={yesNo(status?.configured)} />
          <StatusCard label="appKey" value={yesNo(status?.appKeyConfigured)} />
          <StatusCard label="secretKey" value={yesNo(status?.secretKeyConfigured)} />
          <StatusCard label="source" value={status?.source || '-'} />
          <StatusCard label="userId" value={status?.userId || '-'} />
          <StatusCard label="scoring mode" value={status?.scoringMode || '-'} />
          <StatusCard label="expiry" value={formatDate(status?.expiresAt)} />
          <StatusCard label="last test" value={status?.lastTestedAt ? `${status.lastTestOk ? 'ok' : 'failed'} · ${formatDate(status.lastTestedAt)}` : '-'} />
        </div>
      </section>

      <SpeechSuperCredentialHistory history={status?.history} />

      <form onSubmit={save} className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-white/50">
            <span>appKey</span>
            <input className={inputClass()} value={form.appKey} onChange={e => setForm({ ...form, appKey: e.target.value })} autoComplete="off" />
          </label>
          <label className="grid gap-1 text-xs text-white/50">
            <span>secretKey</span>
            <input className={inputClass()} value={form.secretKey} onChange={e => setForm({ ...form, secretKey: e.target.value })} type="password" autoComplete="new-password" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-white/50">
            <span>userId</span>
            <input className={inputClass()} value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} />
          </label>
          <label className="grid gap-1 text-xs text-white/50">
            <span>scoring mode</span>
            <select className={inputClass()} value={form.scoringMode} onChange={e => setForm({ ...form, scoringMode: e.target.value })}>
              <option value="azure">azure</option>
              <option value="speechsuper">speechsuper</option>
              <option value="both">both</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-white/50">
            <span>expiry date</span>
            <input className={inputClass()} value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} type="date" />
          </label>
        </div>

        {message && <div className="rounded-xl border border-white/10 bg-gray-950/40 px-3 py-2 text-sm text-white/70">{message}</div>}

        <div className="grid gap-2 sm:grid-cols-2">
          <button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-300 py-3 font-bold text-gray-950 disabled:opacity-40">
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={test} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-gray-950 disabled:opacity-40">
            <FlaskConical size={16} /> Test SpeechSuper
          </button>
        </div>
      </form>
    </div>
  )
}
