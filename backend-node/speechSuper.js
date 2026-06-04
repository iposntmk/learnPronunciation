import { resolveSpeechSuperCredential } from './speechSuperCredentials.js'
import { normalizeSpeechSuper, sendSpeechSuperRequest } from './speechSuperApi.js'
import { json, parseMultipart, readBody } from './http.js'

export async function handleSpeechSuperPronunciation(req, res) {
  let fields = {}
  let files = {}
  try {
    ;({ fields, files } = parseMultipart(req, await readBody(req)))
  } catch (err) {
    return json(res, 400, { detail: err.message })
  }

  const text = String(fields.text || '').trim()
  const audio = files.audio
  if (!text) return json(res, 400, { detail: 'Missing text.' })
  if (!audio?.content?.length) return json(res, 400, { detail: 'Missing audio.' })

  let credential
  try {
    credential = await resolveSpeechSuperCredential()
  } catch (err) {
    return json(res, 500, { detail: `SpeechSuper credential error: ${err.message}` })
  }

  if (!credential.configured) return json(res, 500, { detail: 'SpeechSuper configuration is missing.' })
  if (credential.expiresAt && Date.now() >= new Date(credential.expiresAt).getTime()) {
    return json(res, 403, { detail: 'SpeechSuper credential has expired.' })
  }

  const userId = String(fields.userId || credential.userId || 'guest').trim() || 'guest'

  try {
    const { response, rawText } = await sendSpeechSuperRequest({
      appKey: credential.appKey,
      secretKey: credential.secretKey,
      userId,
      text,
      audio,
    })
    if (!response.ok) return json(res, 502, { detail: `SpeechSuper API error ${response.status}: ${rawText.slice(0, 200)}` })
    return json(res, 200, normalizeSpeechSuper(JSON.parse(rawText), text))
  } catch (err) {
    const message = err.name === 'AbortError' ? 'SpeechSuper request timed out.' : err.message
    return json(res, 502, { detail: message })
  }
}
