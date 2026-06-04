import { Search, ChevronRight } from 'lucide-react'
import { DICTIONARY_LANGUAGES, LANGUAGE_FLAG, LANGUAGE_SHORT } from '../../utils/constants/languages.js'

// Free-text search form + the single "search result" card.
export default function DictionarySearchPanel({ query, setQuery, searchLanguages, setSearchLanguages, onSubmit, searchResult, onClearResult, onOpenWord }) {
  return (
    <>
      <form onSubmit={onSubmit} className="px-4 mb-6">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nhập từ cần tra..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-5 font-semibold transition-colors">
            Tra
          </button>
        </div>

        <div className="flex flex-wrap gap-3 px-1">
          {DICTIONARY_LANGUAGES.map(lang => (
            <label key={lang} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={searchLanguages.includes(lang)}
                onChange={e => {
                  if (e.target.checked) setSearchLanguages(prev => [...prev, lang])
                  else setSearchLanguages(prev => prev.filter(l => l !== lang))
                }}
                className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 focus:ring-blue-600 focus:ring-offset-gray-900"
              />
              <span className={`text-xs font-medium transition-colors ${searchLanguages.includes(lang) ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                {LANGUAGE_FLAG[lang]} {LANGUAGE_SHORT[lang]}
              </span>
            </label>
          ))}
        </div>
      </form>

      {searchResult && (
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Search size={16} className="text-blue-400" />
              Kết quả tìm kiếm
            </h2>
            <button onClick={onClearResult} className="text-[10px] text-white/40 hover:text-white/60">Xóa</button>
          </div>
          <button
            onClick={() => onOpenWord(searchResult.word, {
              meaning: searchResult.meaning,
              source: searchResult.source,
              language: searchResult.language,
              entry: searchResult.entry,
              strictLookup: true
            })}
            className="w-full text-left rounded-3xl bg-blue-600/10 border border-blue-500/30 p-5 group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">{searchResult.word}</span>
                  <span className="text-lg">{LANGUAGE_FLAG[searchResult.language]}</span>
                </div>
                <div className="text-white/60 text-sm italic line-clamp-2">{searchResult.meaning}</div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${searchResult.source === 'common' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {searchResult.source === 'common' ? 'Trong thư viện' : 'Tìm thấy bên ngoài'}
                  </span>
                  <span className="text-[10px] text-white/30">Chạm để luyện phát âm →</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-300 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg shadow-blue-900/20">
                <ChevronRight size={24} />
              </div>
            </div>
          </button>
        </div>
      )}
    </>
  )
}
