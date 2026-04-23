import React, { useEffect, useMemo, useState } from 'react'
import { read, utils } from 'xlsx'
import { ChevronLeft, Plus, Search, Trash2 } from 'lucide-react'
import {
  LEVELS,
  WORD_TYPES,
  deleteCategory,
  deleteWord,
  importWords,
  listCategories,
  listProfiles,
  listWords,
  updateProfile,
  upsertCategory,
  upsertWord,
} from './supabaseData.js'

const emptyWord = {
  word: '',
  type: 'other',
  ipa: '',
  vietnamese_definition: '',
  example_sentence: '',
  root_word: '',
  family_words: '',
  synonyms: '',
  antonyms: '',
  category_id: '',
  level: '',
}

const emptyCategory = { name: '', slug: '', description: '', level: '' }

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-xs text-white/50">
      <span>{label}</span>
      {children}
    </label>
  )
}

function inputClass() {
  return 'w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-white outline-none focus:border-emerald-300'
}

export default function AdminScreen({ profile, onBack }) {
  const [tab, setTab] = useState('words')
  const [categories, setCategories] = useState([])
  const [words, setWords] = useState([])
  const [profiles, setProfiles] = useState([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [wordForm, setWordForm] = useState(emptyWord)
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const refreshCategories = async () => setCategories(await listCategories())
  const refreshWords = async () => setWords(await listWords({ query, categoryId: categoryFilter }))
  const refreshProfiles = async () => setProfiles(await listProfiles())

  useEffect(() => {
    refreshCategories().catch(err => setMessage(err.message))
  }, [])

  useEffect(() => {
    if (tab === 'words') refreshWords().catch(err => setMessage(err.message))
    if (tab === 'users') refreshProfiles().catch(err => setMessage(err.message))
  }, [tab, query, categoryFilter])

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.id, label: `${c.level ? `${c.level} · ` : ''}${c.name}` })), [categories])

  const saveWord = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await upsertWord(wordForm)
      setWordForm(emptyWord)
      await refreshWords()
      setMessage('Đã lưu từ.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveCategory = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await upsertCategory(categoryForm)
      setCategoryForm(emptyCategory)
      await refreshCategories()
      setMessage('Đã lưu chủ đề.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const imported = await importWords(rows, categories)
      await refreshWords()
      setMessage(`Đã import ${imported.length} từ từ Excel.`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <button onClick={onBack} className="mb-4 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-white/50 text-sm mt-2">Tài khoản hiện tại chưa có role admin. Chạy SQL: update public.profiles set role = 'admin' where email = 'email-của-bạn';</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24 text-white">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ChevronLeft size={20} /></button>
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-white/40 text-xs">Words, categories, users</p>
        </div>
      </div>

      <div className="px-4 flex gap-2 mb-4">
        {['words', 'categories', 'users'].map(item => (
          <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === item ? 'bg-white text-gray-950' : 'bg-white/10 text-white/60'}`}>
            {item}
          </button>
        ))}
      </div>

      {message && <div className="mx-4 mb-4 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-yellow-100 text-sm">{message}</div>}

      {tab === 'words' && (
        <div className="px-4 grid gap-4">
          <form onSubmit={saveWord} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 text-white font-semibold"><Plus size={16} /> {wordForm.id ? 'Sửa từ' : 'Thêm từ'}</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Từ"><input className={inputClass()} value={wordForm.word} onChange={e => setWordForm({ ...wordForm, word: e.target.value })} required /></Field>
              <Field label="Loại từ">
                <select className={inputClass()} value={wordForm.type} onChange={e => setWordForm({ ...wordForm, type: e.target.value })}>{WORD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              </Field>
            </div>
            <Field label="IPA"><input className={inputClass()} value={wordForm.ipa || ''} onChange={e => setWordForm({ ...wordForm, ipa: e.target.value })} /></Field>
            <Field label="Nghĩa tiếng Việt"><textarea className={inputClass()} value={wordForm.vietnamese_definition} onChange={e => setWordForm({ ...wordForm, vietnamese_definition: e.target.value })} required /></Field>
            <Field label="Ví dụ"><textarea className={inputClass()} value={wordForm.example_sentence || ''} onChange={e => setWordForm({ ...wordForm, example_sentence: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Từ gốc"><input className={inputClass()} value={wordForm.root_word || ''} onChange={e => setWordForm({ ...wordForm, root_word: e.target.value })} /></Field>
              <Field label="Level"><select className={inputClass()} value={wordForm.level || ''} onChange={e => setWordForm({ ...wordForm, level: e.target.value })}><option value="">None</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
            </div>
            <Field label="Family words"><input className={inputClass()} value={wordForm.family_words || ''} onChange={e => setWordForm({ ...wordForm, family_words: e.target.value })} placeholder="comma separated" /></Field>
            <Field label="Từ đồng nghĩa"><input className={inputClass()} value={wordForm.synonyms || ''} onChange={e => setWordForm({ ...wordForm, synonyms: e.target.value })} /></Field>
            <Field label="Từ trái nghĩa"><input className={inputClass()} value={wordForm.antonyms || ''} onChange={e => setWordForm({ ...wordForm, antonyms: e.target.value })} /></Field>
            <Field label="Chủ đề"><select className={inputClass()} value={wordForm.category_id || ''} onChange={e => setWordForm({ ...wordForm, category_id: e.target.value })}><option value="">None</option>{categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
            <div className="flex gap-2">
              <button disabled={loading} className="flex-1 rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">Lưu</button>
              <button type="button" onClick={() => setWordForm(emptyWord)} className="rounded-xl bg-white/10 px-4">Clear</button>
            </div>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input className={`${inputClass()} pl-9`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Tra từ..." />
              </div>
              <label className="rounded-xl bg-white text-gray-950 px-3 py-2.5 text-xs font-bold cursor-pointer">
                Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
              </label>
            </div>
            <select className={`${inputClass()} mb-3`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">Tất cả chủ đề</option>
              {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <div className="grid gap-2">
              {words.map(item => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-gray-950/40 p-3">
                  <div className="flex gap-2">
                    <button onClick={() => setWordForm({
                      ...item,
                      family_words: (item.family_words || []).join(', '),
                      synonyms: (item.synonyms || []).join(', '),
                      antonyms: (item.antonyms || []).join(', '),
                      category_id: item.category_id || '',
                      level: item.level || '',
                    })} className="min-w-0 flex-1 text-left">
                      <div className="font-semibold truncate">{item.word} <span className="text-white/35 text-xs">/{item.ipa || '-'}/</span></div>
                      <div className="text-white/45 text-xs truncate">{item.vietnamese_definition}</div>
                      <div className="text-white/30 text-[11px]">{item.categories?.name || 'No category'} · {item.level || 'No level'}</div>
                    </button>
                    <button onClick={async () => { await deleteWord(item.id); await refreshWords() }} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-200 flex items-center justify-center"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="px-4 grid gap-4">
          <form onSubmit={saveCategory} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <Field label="Tên chủ đề"><input className={inputClass()} value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></Field>
            <Field label="Slug"><input className={inputClass()} value={categoryForm.slug || ''} onChange={e => setCategoryForm({ ...categoryForm, slug: e.target.value })} /></Field>
            <Field label="Level"><select className={inputClass()} value={categoryForm.level || ''} onChange={e => setCategoryForm({ ...categoryForm, level: e.target.value })}><option value="">None</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Mô tả"><textarea className={inputClass()} value={categoryForm.description || ''} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} /></Field>
            <button disabled={loading} className="rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">Lưu chủ đề</button>
          </form>
          <div className="grid gap-2">
            {categories.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <button onClick={() => setCategoryForm(item)} className="flex-1 text-left">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-white/40 text-xs">{item.slug} · {item.level || 'No level'}</div>
                </button>
                <button onClick={async () => { await deleteCategory(item.id); await refreshCategories() }} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-200 flex items-center justify-center"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="px-4 grid gap-2">
          {profiles.map(item => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">{item.email || item.id}</div>
              <input className={`${inputClass()} mt-2`} value={item.full_name || ''} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, full_name: e.target.value } : p))} placeholder="Full name" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select className={inputClass()} value={item.role} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, role: e.target.value } : p))}>
                  {['admin', 'teacher', 'student'].map(role => <option key={role}>{role}</option>)}
                </select>
                <label className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-sm flex items-center gap-2">
                  <input type="checkbox" checked={item.is_active} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, is_active: e.target.checked } : p))} />
                  Active
                </label>
              </div>
              <button onClick={async () => { await updateProfile(item); await refreshProfiles() }} className="mt-2 w-full rounded-xl bg-white text-gray-950 font-semibold py-2.5">Lưu user</button>
            </div>
          ))}
          <p className="text-white/35 text-xs leading-relaxed">Xóa Auth user cần Supabase Dashboard hoặc Edge Function dùng service_role. Frontend anon key chỉ nên sửa profile, role, active.</p>
        </div>
      )}
    </div>
  )
}
