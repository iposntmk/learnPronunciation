import { Search } from 'lucide-react'

export default function PracticeNavigationActions({
  compact,
  learnedControl,
  onToggleLearned,
  navButtons,
  onDictionary,
  onSearchWord,
  searchVal,
  setSearchVal,
}) {
  if (!learnedControl && !navButtons && !onDictionary && (!onSearchWord || compact)) return null

  return (
    <div className={`px-4 pb-4 flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {learnedControl && (
        <button
          type="button"
          onClick={onToggleLearned}
          className={`w-full rounded-2xl ${compact ? 'py-2 text-base' : 'py-5 text-lg'} flex items-center justify-center gap-3 font-bold border transition-transform active:scale-95 ${learnedControl.checked ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200' : 'bg-white/5 border-white/10 text-white/75'}`}
        >
          <span className={`w-6 h-6 rounded-md border flex items-center justify-center ${learnedControl.checked ? 'bg-emerald-400 border-emerald-300 text-gray-950' : 'border-white/30 text-transparent'}`}>✓</span>
          Done
        </button>
      )}

      {navButtons}

      {onDictionary && (
        <button
          type="button"
          onClick={onDictionary}
          className={`w-full rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-200 ${compact ? 'py-2 text-xs' : 'py-3 text-sm'} flex items-center justify-center gap-2 font-bold active:scale-95 transition-transform`}
          aria-label="Open dictionary search"
        >
          <Search size={compact ? 14 : 16} />
          Search in Dictionary
        </button>
      )}

      {onSearchWord && !compact && (
        <form onSubmit={event => {
          event.preventDefault()
          const nextWord = searchVal.trim()
          if (nextWord) {
            onSearchWord(nextWord)
            setSearchVal('')
          }
        }}
          className="flex gap-2 pt-1 border-t border-white/10 mt-1">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={searchVal}
              onChange={event => setSearchVal(event.target.value)}
              placeholder="Practice another word..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25"
            />
          </div>
          <button type="submit"
            className="bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl px-4 text-sm font-semibold transition-colors active:scale-95">
            Search
          </button>
        </form>
      )}
    </div>
  )
}
