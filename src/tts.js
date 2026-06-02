// ElevenLabs TTS qua backend proxy, cache theo session
import { requestElevenLabsTts } from './utils/tts/elevenLabsProxy.js'

const CACHE = new Map()   // 'lang:rate:text' → object URL
let _currentAudio = null

function shouldUseBrowserTTS() {
  try {
    const s = JSON.parse(localStorage.getItem('practiceSettings') || '{}')
    return s.useBrowserTTS === true
  } catch { return false }
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

async function playElevenLabsSpeech({ cacheKey, text, lang, kind, label }) {
  if (shouldUseBrowserTTS()) { speakBrowser(text, lang); return }
  if (CACHE.has(cacheKey)) { playUrl(CACHE.get(cacheKey)); return }

  try {
    const blob = await requestElevenLabsTts({ text, language: lang, kind })
    const url = URL.createObjectURL(blob)
    CACHE.set(cacheKey, url)
    playUrl(url)
  } catch (e) {
    console.warn(`[${label}] ElevenLabs backend failed, using browser fallback:`, e.message)
    speakBrowser(text, lang)
  }
}

// rate: 0.9 = hơi chậm nhưng vẫn tự nhiên; 1.0 = tốc độ bình thường
export async function speakNeural(text, lang = 'en-US', rate = 0.9) {
  const cacheKey = `${lang}:${rate}:${text}`
  return playElevenLabsSpeech({ cacheKey, text, lang, kind: 'word', label: 'TTS' })
}

// Speak a full sentence at natural speed with conversational style for native-sounding delivery
export async function speakSentenceNeural(text, lang = 'en-US') {
  const cacheKey = `sent:${lang}:${text}`
  return playElevenLabsSpeech({ cacheKey, text, lang, kind: 'sentence', label: 'TTS sentence' })
}

// Speak a single phoneme or its nearest display text.
export async function speakPhoneme(text, ipa, lang = 'en-US') {
  const cacheKey = `ph:${lang}:${ipa}`
  return playElevenLabsSpeech({ cacheKey, text: text || ipa, lang, kind: 'phoneme', label: 'TTS phoneme' })
}
