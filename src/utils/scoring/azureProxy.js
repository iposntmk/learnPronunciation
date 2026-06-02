import { recordAzureUsage } from '../../azureUsage.js'
import { audioBlobToPcmWav } from '../audio/audioWav.js'

function proxyBaseUrl() {
  const raw = import.meta.env?.VITE_AZURE_PROXY_URL || ''
  return raw.trim().replace(/\/azure\/(?:word|sentence|tts|status)\/?$/i, '').replace(/\/$/, '')
}

export function hasAzureProxy() {
  return Boolean(proxyBaseUrl())
}

function endpoint(path) {
  const baseUrl = proxyBaseUrl()
  if (!baseUrl) throw new Error('VITE_AZURE_PROXY_URL chưa được cấu hình.')
  return `${baseUrl}${path}`
}

async function parseJsonResponse(response, label) {
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    if (!response.ok) throw new Error(`${label} ${response.status}: ${text.slice(0, 160)}`)
    throw new Error(`${label} returned invalid JSON.`)
  }
  if (!response.ok) throw new Error(data.detail || `${label} ${response.status}`)
  return data
}

function recordUsageFromWav(wavBlob) {
  const seconds = Math.max(0, (wavBlob.size - 44) / (16000 * 2))
  recordAzureUsage(seconds)
}

export async function scoreWordViaAzureProxy(audioBlob, phonemes, referenceText, language = 'en-US') {
  const wavBlob = await audioBlobToPcmWav(audioBlob)
  recordUsageFromWav(wavBlob)
  const form = new FormData()
  form.append('audio', wavBlob, 'azure-word.wav')
  form.append('referenceText', referenceText)
  form.append('language', language)
  form.append('phonemes', JSON.stringify(phonemes || []))
  const response = await fetch(endpoint('/azure/word'), { method: 'POST', body: form })
  return parseJsonResponse(response, 'Azure word')
}

export async function scoreSentenceViaAzureProxy(audioBlob, referenceText, language = 'en-US') {
  const wavBlob = await audioBlobToPcmWav(audioBlob)
  recordUsageFromWav(wavBlob)
  const form = new FormData()
  form.append('audio', wavBlob, 'azure-sentence.wav')
  form.append('referenceText', referenceText)
  form.append('language', language)
  const response = await fetch(endpoint('/azure/sentence'), { method: 'POST', body: form })
  return parseJsonResponse(response, 'Azure sentence')
}
