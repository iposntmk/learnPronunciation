import { useEffect, useState } from 'react'
import { getSpeechSuperStatus, speechSuperExpiryDaysLeft } from '../../utils/scoring/scoringConfig.js'

export default function SpeechSuperTrialBanner() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let active = true
    getSpeechSuperStatus().then(value => { if (active) setStatus(value) })
    return () => { active = false }
  }, [])

  if (status?.scoringMode === 'azure' || status?.configured === false || !status?.expiresAt) return null

  const left = speechSuperExpiryDaysLeft(status.expiresAt)
  if (left == null) return null

  const expired = left <= 0
  const cls = expired ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'

  return (
    <div className={`mx-4 mt-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold ${cls}`}>
      {expired
        ? 'SpeechSuper credential expired. The app is using Azure scoring.'
        : `SpeechSuper credential expires in ${left} day${left === 1 ? '' : 's'}.`}
    </div>
  )
}
