import { useEffect, useState } from 'react'
import { getConfiguredMode, speechSuperTrialDaysLeft } from '../../utils/scoring/scoringConfig.js'

// Banner đếm ngược hạn dùng thử SpeechSuper. Chỉ hiện khi user cấu hình mode dùng SpeechSuper
// (speechsuper/both). Hết hạn → báo app đã tự chuyển sang Azure.
export default function SpeechSuperTrialBanner() {
  const [mode, setMode] = useState('azure')

  useEffect(() => {
    let active = true
    getConfiguredMode().then(value => { if (active) setMode(value) })
    return () => { active = false }
  }, [])

  if (mode === 'azure') return null
  const left = speechSuperTrialDaysLeft()
  const expired = left <= 0
  const cls = expired ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'

  return (
    <div className={`mx-4 mt-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold ${cls}`}>
      {expired
        ? '⚠️ SpeechSuper đã hết hạn dùng thử — app đang tự chấm bằng Azure.'
        : `⏳ SpeechSuper dùng thử còn ${left} ngày (hết hạn 17/06/2026). Hết hạn sẽ tự chuyển sang Azure.`}
    </div>
  )
}
