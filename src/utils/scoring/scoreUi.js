export function scoreColor(score) {
  return score >= 85 ? 'text-emerald-400' : score >= 65 ? 'text-yellow-400' : 'text-red-400'
}

export function scoreBg(score) {
  return score >= 85
    ? 'bg-emerald-500/20 border-emerald-500/50'
    : score >= 65
      ? 'bg-yellow-500/20 border-yellow-500/50'
      : 'bg-red-500/20 border-red-500/50'
}

export function scoreTextBg(score) {
  return score >= 85
    ? 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30'
    : score >= 65
      ? 'bg-amber-400/15 text-amber-100 border-amber-300/30'
      : 'bg-red-500/15 text-red-100 border-red-400/30'
}

export function scoreLabel(score) {
  if (score >= 90) return 'Excellent!'
  if (score >= 75) return 'Good job!'
  if (score >= 60) return 'Almost there'
  return 'Keep practicing'
}
