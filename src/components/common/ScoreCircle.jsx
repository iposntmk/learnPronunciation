export default function ScoreCircle({ score, size = 44 }) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
  const r = 18
  const c = 2 * Math.PI * r
  const off = c * (1 - s / 100)
  const stroke = s >= 85 ? '#34d399' : s >= 65 ? '#facc15' : '#f87171'

  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'none', transform: 'rotate(-90deg)', transformOrigin: '22px 22px' }}
        />
        <text x="22" y="24" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.9)" fontWeight="700">
          {s}%
        </text>
      </svg>
    </div>
  )
}
