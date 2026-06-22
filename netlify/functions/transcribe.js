// netlify/functions/transcribe.js
// Groq Whisper with multi-key rotation - same resilience as chat.js
// Uses GROQ_KEY_1 through GROQ_KEY_5 with instant failover

const WHISPER_ENDPOINT  = 'https://api.groq.com/openai/v1/audio/transcriptions'
const WHISPER_MODEL     = 'whisper-large-v3-turbo'
const FETCH_TIMEOUT_MS  = 15000 // Whisper needs more time than chat - audio upload takes longer

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  // Collect all available Groq keys - same env vars as chat.js
  const groqKeys = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5,
    // Also accept the old single key for backwards compatibility
    process.env.GROQ_API_KEY,
  ].filter(Boolean)

  if (groqKeys.length === 0) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No Groq API keys configured' }) }
  }

  let audioBase64, mimeType
  try {
    const body  = JSON.parse(event.body || '{}')
    audioBase64 = body.audio
    mimeType    = body.mimeType || 'audio/webm'
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!audioBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data provided' }) }
  }

  if (audioBase64.length > 10 * 1024 * 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Audio too large. Keep answers under 3 minutes.' }) }
  }

  // Build the audio buffer and blob once - reuse across retries
  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const audioBlob   = new Blob([audioBuffer], { type: mimeType })

  let ext = 'webm'
  if (mimeType.includes('mp4')) ext = 'mp4'
  else if (mimeType.includes('ogg')) ext = 'ogg'
  else if (mimeType.includes('wav')) ext = 'wav'
  else if (mimeType.includes('m4a')) ext = 'm4a'

  // Try each key with a timeout - same pattern as chat.js
  for (let i = 0; i < groqKeys.length; i++) {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      // FormData must be rebuilt each attempt because it can only be consumed once
      const formData = new FormData()
      formData.append('file',     audioBlob, `recording.${ext}`)
      formData.append('model',    WHISPER_MODEL)
      formData.append('language', 'en')

      const response = await fetch(WHISPER_ENDPOINT, {
        method:  'POST',
        headers: { Authorization: `Bearer ${groqKeys[i]}` },
        body:    formData,
        signal:  controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 429) {
        console.log(`Whisper GROQ_KEY_${i + 1} rate limited, trying next key`)
        continue
      }

      if (response.status >= 500) {
        console.log(`Whisper GROQ_KEY_${i + 1} server error ${response.status}, trying next key`)
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        console.error(`Whisper GROQ_KEY_${i + 1} error:`, response.status, errText.slice(0, 200))
        continue
      }

      const data = await response.json()
      console.log(`Whisper success using GROQ_KEY_${i + 1}`)
      return { statusCode: 200, headers, body: JSON.stringify({ text: data.text || '' }) }

    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        console.log(`Whisper GROQ_KEY_${i + 1} timed out after ${FETCH_TIMEOUT_MS}ms, trying next key`)
      } else {
        console.error(`Whisper GROQ_KEY_${i + 1} threw:`, err.message)
      }
    }
  }

  // All keys exhausted
  console.error('All Groq keys failed for Whisper transcription')
  return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription failed - all keys exhausted' }) }
}
