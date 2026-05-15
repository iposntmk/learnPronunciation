import { useCallback, useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { LEVELS, LANGUAGE_FLAG, LANGUAGE_LABEL, listLevels, listSentenceTopics, listSentences, normalizeLanguage } from '../../supabaseData.js'
import { scoreBg, scoreColor } from '../../utils/scoring/scoreUi.js'

export default function SentenceLibraryScreen({ sentenceProgress = {}, onPracticeSentence }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [topicOptions, setTopicOptions] = useState([])
  const [levelOptions, setLevelOptions] = useState(LEVELS)

  useEffect(() => {
    let cancelled = false
    listLevels()
      .then(rows => {
        if (cancelled) return
        const codes = rows.map(row => row.code)
        if (codes.length > 0) setLevelOptions(codes)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      listSentences({ query, level: levelFilter, topic: topicFilter, language: languageFilter, limit: 60, offset: 0 }),
      listSentenceTopics({ level: levelFilter, language: languageFilter }),
    ])
      .then(([result, topics]) => {
        if (cancelled) return
        setItems(result.items || [])
        setTotal(result.total || 0)
        setHasMore(!!result.hasMore)
        setTopicOptions(topics || [])
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Could not load sentences.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [languageFilter, levelFilter, query, topicFilter])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await listSentences({ query, level: levelFilter, topic: topicFilter, language: languageFilter, limit: 60, offset: items.length })
      setItems(prev => [...prev, ...(result.items || [])])
      setTotal(result.total || 0)
      setHasMore(!!result.hasMore)
    } catch (err) {
      setError(err.message || 'Could not load sentences.')
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, items.length, languageFilter, levelFilter, loading, loadingMore, query, topicFilter])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-3">
        <div className="text-white text-2xl font-bold">Sentence Practice</div>
        <div className="text-white/45 text-sm mt-1">Choose a sentence and practice full-sentence pronunciation.</div>
      </div>

      <div className="px-4 flex flex-col gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sentence or topic" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/25 outline-none" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none">
            <option value="all">All languages</option>
            {Object.keys(LANGUAGE_LABEL).map(language => <option key={language} value={language}>{LANGUAGE_LABEL[language] || language}</option>)}
          </select>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none">
            <option value="all">All levels</option>
            <option value="none">No level</option>
            {levelOptions.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none">
            <option value="all">All topics</option>
            {topicOptions.map(topic => <option key={topic} value={topic}>{topic}</option>)}
          </select>
        </div>

        {loading && <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/50 text-sm">Loading sentences...</div>}
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-red-200 text-sm">{error}</div>}
        {!loading && !error && <div className="text-white/45 text-xs">Loaded {items.length}/{total} sentences</div>}

        {!loading && !error && items.map(item => {
          const progress = sentenceProgress[item.id] || null
          const itemLanguage = normalizeLanguage(item.language || 'english')
          const languageLabel = LANGUAGE_LABEL[itemLanguage] || itemLanguage
          return (
            <button key={item.id} type="button" onClick={() => onPracticeSentence(item)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left active:scale-[0.99] transition-transform">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center text-cyan-200 font-bold">
                  <Mic size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold leading-snug">{item.sentence}</div>
                  <div className="text-white/55 text-sm mt-1 leading-snug">{item.vietnamese_translation}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">{LANGUAGE_FLAG[itemLanguage] || ''} {languageLabel}</span>
                    {item.topic && <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60">{item.topic}</span>}
                    {item.level && <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">{item.level}</span>}
                    {progress && Number.isFinite(progress.score) && <span className={`rounded-lg border px-2 py-1 ${scoreBg(progress.score)} ${scoreColor(progress.score)}`}>Score {progress.score}%</span>}
                    {progress && Number.isFinite(progress.prosodyScore) && <span className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-fuchsia-200">Intonation {progress.prosodyScore}%</span>}
                  </div>
                </div>
              </div>
            </button>
          )
        })}

        {!loading && !error && items.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/45 text-sm text-center">No matching sentences found.</div>}
        {!loading && !error && hasMore && (
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 disabled:opacity-50">
            {loadingMore ? 'Loading...' : `Load more ${Math.min(60, Math.max(total - items.length, 0))} sentences`}
          </button>
        )}
      </div>
    </div>
  )
}
