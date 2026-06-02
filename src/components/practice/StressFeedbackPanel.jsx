export default function StressFeedbackPanel({ feedback = [], compact = false }) {
  if (!feedback.length) return null

  return (
    <div className={`mx-4 ${compact ? 'mt-2' : 'mt-3'} rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-left`}>
      <div className="text-violet-100 text-xs font-bold uppercase tracking-wide">Word stress</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {feedback.map((message, index) => (
          <p key={`${message}-${index}`} className="text-violet-50/90 text-sm leading-relaxed">
            {message}
          </p>
        ))}
      </div>
    </div>
  )
}
