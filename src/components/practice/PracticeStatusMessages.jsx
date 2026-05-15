export default function PracticeStatusMessages({
  compact,
  errorMsg,
  lookupNote,
  phase,
  isResolvingPhonemes,
}) {
  if (!errorMsg && (compact || !lookupNote || phase !== 'ready') && !(isResolvingPhonemes && phase === 'ready')) return null

  return (
    <div className={`px-4 pb-3 flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {errorMsg && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg mt-0.5">!</span>
          <p className="text-red-300 text-sm leading-relaxed">{errorMsg}</p>
        </div>
      )}
      {!compact && lookupNote && phase === 'ready' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
          <p className="text-amber-200 text-sm leading-relaxed">{lookupNote}</p>
        </div>
      )}
      {isResolvingPhonemes && phase === 'ready' && (
        <div className="w-full rounded-2xl py-3 bg-white/5 border border-white/10 text-white/50 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Resolving IPA for this word...
        </div>
      )}
    </div>
  )
}
