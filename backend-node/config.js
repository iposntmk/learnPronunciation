import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { elevenLabsStatus } from './elevenLabs.js'
import { getSpeechSuperCredentialStatus } from './speechSuperCredentials.js'

const ENV_PATH = resolve(process.cwd(), '.env.local')

const SCORING_MODES = new Set(['azure', 'speechsuper', 'both'])
function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase()
  return SCORING_MODES.has(mode) ? mode : 'azure'
}

export function loadEnvFile(path = ENV_PATH) {
  if (!existsSync(path)) return
  readFileSync(path, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match) return
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] == null) process.env[key] = value
  })
}

export function loadDefaultEnv() {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  loadEnvFile(resolve(process.cwd(), '.env'))
}

export function statusPayload() {
  const appKey = (process.env.SPEECHSUPER_APP_KEY || '').trim()
  const secretKey = (process.env.SPEECHSUPER_SECRET_KEY || '').trim()
  const azureKey = (process.env.AZURE_KEY || '').trim()
  const azureRegion = (process.env.AZURE_REGION || 'southeastasia').trim()
  const speechSuperConfigured = Boolean(appKey && secretKey)
  const azureConfigured = Boolean(azureKey && azureRegion)
  return {
    configured: speechSuperConfigured,
    speechSuperConfigured,
    appKeyConfigured: Boolean(appKey),
    secretKeyConfigured: Boolean(secretKey),
    userId: (process.env.SPEECHSUPER_USER_ID || 'guest').trim() || 'guest',
    endpoint: '/speechsuper/pronunciation',
    azureConfigured,
    azureKeyConfigured: Boolean(azureKey),
    azureRegion,
    scoringMode: normalizeMode(process.env.SCORING_MODE),
    azureEndpoints: {
      word: '/azure/word',
      sentence: '/azure/sentence',
      tts: '/azure/tts',
    },
    ...elevenLabsStatus(),
  }
}

export async function statusPayloadAsync() {
  const envStatus = statusPayload()
  try {
    const speechSuper = await getSpeechSuperCredentialStatus()
    return {
      ...envStatus,
      configured: speechSuper.configured,
      speechSuperConfigured: speechSuper.configured,
      appKeyConfigured: speechSuper.appKeyConfigured,
      secretKeyConfigured: speechSuper.secretKeyConfigured,
      userId: speechSuper.userId || envStatus.userId,
      scoringMode: speechSuper.scoringMode || envStatus.scoringMode,
      expiresAt: speechSuper.expiresAt || null,
      lastTestedAt: speechSuper.lastTestedAt || null,
      lastTestOk: speechSuper.lastTestOk ?? null,
      credentialSource: speechSuper.source,
    }
  } catch {
    return envStatus
  }
}

function upsertEnv(content, key, value) {
  const line = `${key}=${value}`
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}=.*$`, 'm')
  if (re.test(content)) return content.replace(re, line)
  return `${content.replace(/\s*$/, '')}\n${line}\n`
}

function persistBackendEnv() {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  ;['AZURE_KEY', 'AZURE_REGION', 'SPEECHSUPER_APP_KEY', 'SPEECHSUPER_SECRET_KEY', 'SPEECHSUPER_USER_ID', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_MODEL_ID', 'SCORING_MODE'].forEach(key => {
    content = upsertEnv(content, key, process.env[key] || '')
  })
  writeFileSync(ENV_PATH, content, 'utf8')
}

export function updateConfig({ azureKey, azureRegion, appKey, secretKey, userId, elevenLabsApiKey, elevenLabsVoiceId, elevenLabsModelId, scoringMode, persist } = {}) {
  if (typeof azureKey === 'string' && azureKey.trim()) process.env.AZURE_KEY = azureKey.trim()
  if (typeof azureRegion === 'string' && azureRegion.trim()) process.env.AZURE_REGION = azureRegion.trim()
  if (typeof appKey === 'string' && appKey.trim()) process.env.SPEECHSUPER_APP_KEY = appKey.trim()
  if (typeof secretKey === 'string' && secretKey.trim()) process.env.SPEECHSUPER_SECRET_KEY = secretKey.trim()
  if (typeof userId === 'string' && userId.trim()) process.env.SPEECHSUPER_USER_ID = userId.trim()
  if (typeof elevenLabsApiKey === 'string' && elevenLabsApiKey.trim()) process.env.ELEVENLABS_API_KEY = elevenLabsApiKey.trim()
  if (typeof elevenLabsVoiceId === 'string' && elevenLabsVoiceId.trim()) process.env.ELEVENLABS_VOICE_ID = elevenLabsVoiceId.trim()
  if (typeof elevenLabsModelId === 'string' && elevenLabsModelId.trim()) process.env.ELEVENLABS_MODEL_ID = elevenLabsModelId.trim()
  if (typeof scoringMode === 'string' && scoringMode.trim()) process.env.SCORING_MODE = normalizeMode(scoringMode)
  if (!process.env.SPEECHSUPER_USER_ID) process.env.SPEECHSUPER_USER_ID = 'guest'
  if (!process.env.AZURE_REGION) process.env.AZURE_REGION = 'southeastasia'
  if (persist) persistBackendEnv()
  return statusPayload()
}
