import { Play } from 'lucide-react'
import { speakPhoneme } from '../../tts.js'
import { formatIpa } from '../../utils/phonemes/phonemeFormat.js'
import { scoreBg, scoreColor } from '../../utils/scoring/scoreUi.js'

export default function WordPhonemeGrid({
  phonemes,
  result,
  selectedIdx,
  setSelectedIdx,
  compact,
  lang,
  selectedPhoneme,
  playPhoneme,
}) {
  return (
    <>
      <div className={`flex flex-nowrap justify-start gap-1 overflow-x-auto pb-1 ${compact ? 'mt-1' : 'mt-4'}`}>
        {phonemes.map((phoneme, idx) => {
          const scored = result?.phonemes[idx]
          const hasScore = scored && result?.spokenWord !== null
          const bg = hasScore ? scoreBg(scored.score) : 'bg-white/5 border-white/10'
          const textColor = hasScore ? scoreColor(scored.score) : 'text-white/60'
          return (
            <button
              key={idx}
              onClick={() => {
                speakPhoneme(phoneme.text, phoneme.ipa, lang)
                if (hasScore) setSelectedIdx(selectedIdx === idx ? null : idx)
              }}
              className={`shrink-0 border rounded-xl ${compact ? 'px-2.5 py-1' : 'px-3 py-2'} flex flex-col items-center gap-0.5 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${bg} ${selectedIdx === idx ? 'ring-2 ring-white/40' : ''}`}
            >
              <span className="text-white font-semibold text-sm">{phoneme.text}</span>
              <span className="text-white/45 font-mono text-sm">/{formatIpa(phoneme)}/</span>
              {hasScore && <span className={`text-xs font-bold ${textColor}`}>{scored.score}%</span>}
              {phoneme.isHard && !hasScore && <span className="text-yellow-400 text-xs">â˜…</span>}
            </button>
          )
        })}
      </div>

      {selectedPhoneme && (
        <div className={`mt-3 mx-4 rounded-2xl p-3 border text-left ${scoreBg(selectedPhoneme.score)}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-semibold">
              {selectedPhoneme.text} <span className="text-white/40 font-mono text-sm">/{selectedPhoneme.ipa}/</span>
            </span>
            <div className="flex items-center gap-2">
              {selectedPhoneme.audioOffset !== null && (
                <button onClick={() => playPhoneme(selectedPhoneme)}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 text-white/70 text-xs active:scale-95 transition-transform">
                  <Play size={11} className="fill-white/70 text-white/70" />
                  You
                </button>
              )}
              <span className={`font-bold ${scoreColor(selectedPhoneme.score)}`}>{selectedPhoneme.score}%</span>
            </div>
          </div>
          {selectedPhoneme.note && <p className="text-red-300 text-sm mb-1">{selectedPhoneme.note}</p>}
          <p className="text-white/70 text-sm">{selectedPhoneme.tip}</p>
        </div>
      )}
    </>
  )
}
