// netlify/functions/transcribe.js
// Groq Whisper API — Handles raw audio and converts it to text

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const audioBase64 = body.audio

    if (!audioBase64) {
      throw new Error('No audio data provided')
    }

    // Convert the base64 string back to binary data
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    
    // Package it up for Groq
    const formData = new FormData()
    formData.append('file', blob, 'recording.webm')
    formData.append('model', 'whisper-large-v3-turbo') // Using the fast turbo model
    formData.append('language', 'en') // Forces it to output English text

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Note: We do NOT set 'Content-Type' here. Fetch does it automatically for FormData.
      },
      body: formData
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq Whisper error:', response.status, errText)
      throw new Error(`Groq responded with ${response.status}`)
    }

    const data = await response.json()
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: data.text }),
    }
  } catch (err) {
    console.error('Transcribe function error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Transcription failed' }),
    }
  }
}