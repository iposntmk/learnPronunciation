// Azure Neural TTS — giọng tự nhiên, có cảm xúc, cache theo session

const CACHE = new Map()   // 'lang:rate:text' → object URL
let _currentAudio = null

const AZURE_VOICES = {
  'en-US': 'en-US-JennyNeural',
  'es-ES': 'es-ES-AbrilNeural',
  'it-IT': 'it-IT-ElsaNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
}

function escXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

function playUrl(url) {
  if (_currentAudio) { _currentAudio.pause(); _currentAudio.currentTime = 0 }
  _currentAudio = new Audio(url)
  _currentAudio.play().catch(() => {})
}

function speakBrowser(text, lang) {
  const syn = window.speechSynthesis
  if (!syn) return
  syn.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang; utt.rate = 0.82; utt.pitch = 1
  const voices = syn.getVoices()
  const pick = voices.find(v => v.lang === lang && v.name.includes('Google'))
    || voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.startsWith(lang.split('-')[0]))
  if (pick) utt.voice = pick
  syn.speak(utt)
}

// rate: 0.9 = hơi chậm nhưng vẫn tự nhiên; 1.0 = tốc độ bình thường
export async function speakNeural(text, lang = 'en-US', rate = 0.9) {
  const key = import.meta.env.VITE_AZURE_KEY
  const region = import.meta.env.VITE_AZURE_REGION || 'southeastasia'

  if (!key) { speakBrowser(text, lang); return }

  const cacheKey = `${lang}:${rate}:${text}`
  if (CACHE.has(cacheKey)) { playUrl(CACHE.get(cacheKey)); return }

  const voice = AZURE_VOICES[lang] || 'en-US-JennyNeural'
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'><prosody rate='${rate}'>${escXml(text)}</prosody></voice></speak>`

  try {
    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key.trim().replace(/[\r\n]/g, ''),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    })
    if (!resp.ok) throw new Error(`TTS ${resp.status}`)
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    CACHE.set(cacheKey, url)
    playUrl(url)
  } catch (e) {
    console.warn('[TTS] Azure Neural failed, using browser fallback:', e.message)
    speakBrowser(text, lang)
  }
}

// Speak a single phoneme using IPA phoneme SSML tag
export async function speakPhoneme(text, ipa, lang = 'en-US') {
  const key = import.meta.env.VITE_AZURE_KEY
  const region = import.meta.env.VITE_AZURE_REGION || 'southeastasia'

  if (!key) { speakBrowser(text || ipa, lang); return }

  const cacheKey = `ph:${lang}:${ipa}`
  if (CACHE.has(cacheKey)) { playUrl(CACHE.get(cacheKey)); return }

  const voice = AZURE_VOICES[lang] || 'en-US-JennyNeural'
  const safeText = escXml(text || 'a')
  const safeIpa = escXml(ipa)
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'><prosody rate='0.8'><phoneme alphabet='ipa' ph='${safeIpa}'>${safeText}</phoneme></prosody></voice></speak>`

  try {
    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key.trim().replace(/[\r\n]/g, ''),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    })
    if (!resp.ok) throw new Error(`TTS ${resp.status}`)
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    CACHE.set(cacheKey, url)
    playUrl(url)
  } catch (e) {
    console.warn('[TTS phoneme] Azure failed, using browser fallback:', e.message)
    speakBrowser(text || ipa, lang)
  }
}
