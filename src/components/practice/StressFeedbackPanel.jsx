import { scoreColor } from '../../utils/scoring/scoreUi.js'

// SpeechSuper stress level: 1 = trọng âm chính, 2 = trọng âm phụ, 0 = không
const stressMark = level => (level === 1 ? 'ˈ' : level === 2 ? 'ˌ' : '')

function syllableStyle(syllable) {
  const stressMismatch = syllable.refStress != null
    && syllable.actualStress != null
    && syllable.refStress !== syllable.actualStress
  if (stressMismatch) return 'border-amber-400/60 bg-amber-400/10'
  if (syllable.score != null && syllable.score < 60) return 'border-red-400/50 bg-red-500/10'
  return 'border-emerald-400/40 bg-emerald-500/10'
}

export default function StressFeedbackPanel({ feedback = [], assessment = null, compact = false }) {
  const syllables = assessment?.syllables || []
  if (!feedback.length && !syllables.length) return null

  return (
    <div className={`mx-4 ${compact ? 'mt-2' : 'mt-3'} rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-left`}>
      <div className="flex items-center justify-between">
        <div className="text-violet-100 text-xs font-bold uppercase tracking-wide">Word stress</div>
        {assessment?.stressScore != null && (
          <div className={`text-xs font-bold ${scoreColor(assessment.stressScore)}`}>
            {assessment.stressScore}/100
          </div>
        )}
      </div>

      {syllables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {syllables.map(syllable => (
            <div
              key={syllable.index}
              className={`min-w-[3rem] rounded-xl border px-2.5 py-1.5 text-center ${syllableStyle(syllable)}`}
            >
              <div className="text-sm font-bold text-violet-50">
                <span className="text-violet-300">{stressMark(syllable.refStress)}</span>
                {syllable.spell}
              </div>
              {syllable.phonetic && (
                <div className="text-[10px] text-violet-200/70">/{syllable.phonetic}/</div>
              )}
              {syllable.score != null && (
                <div className={`text-xs font-bold ${scoreColor(syllable.score)}`}>{syllable.score}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {syllables.length > 0 && (
        <div className="mt-1.5 text-[10px] text-violet-200/60">
          <span className="text-violet-300 font-bold">ˈ</span> = âm tiết cần nhấn (trọng âm chính) ·
          viền vàng = bạn nhấn sai chỗ · viền đỏ = âm tiết phát âm yếu
        </div>
      )}

      {feedback.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {feedback.map((message, index) => (
            <p key={`${message}-${index}`} className="text-violet-50/90 text-sm leading-relaxed">
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
