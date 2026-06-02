function configuredTtsUrl() {
  const direct = import.meta.env?.VITE_ELEVENLABS_TTS_URL || ''
  if (direct.trim()) return direct.trim()
  const base = (import.meta.env?.VITE_AZURE_PROXY_URL || '/api')
    .trim()
    .replace(/\/azure\/(?:word|sentence|tts|status)\/?$/i, '')
    .replace(/\/$/, '')
  return `${base}/elevenlabs/tts`
}

export async function requestElevenLabsTts({ text, language, kind }) {
  const response = await fetch(configuredTtsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, kind }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || `ElevenLabs TTS ${response.status}`)
  }
  return response.blob()
}
