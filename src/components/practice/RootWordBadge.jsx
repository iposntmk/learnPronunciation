import { Sprout } from 'lucide-react'

export default function RootWordBadge({ rootWord, currentWord, onSearchWord }) {
  if (!rootWord || rootWord === currentWord.toLowerCase()) return null

  return (
    <div className="mt-1 flex justify-center">
      {onSearchWord ? (
        <button
          type="button"
          onClick={() => onSearchWord(rootWord)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 active:scale-95 transition-transform"
          aria-label={`Practice root word ${rootWord}`}
          title="Practice root word"
        >
          <Sprout size={12} />
          <span className="text-emerald-200/70">Root:</span>
          <span className="text-emerald-100">{rootWord}</span>
          <span className="text-emerald-200/70">Â· Practice</span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70">
          <Sprout size={12} />
          <span className="text-white/50">Root:</span>
          <span className="text-white/85">{rootWord}</span>
        </span>
      )}
    </div>
  )
}
