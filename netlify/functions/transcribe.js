// netlify/functions/transcribe.js
// Powered by Google Gemini 2.5 Flash - Free Native Audio Transcription

const GEMINI_TRANSCRIPTION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Keeping your existing environment variable name intact
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'API Key not configured' }) };

  let audioBase64, mimeType;
  try {
    const body  = JSON.parse(event.body || '{}');
    audioBase64 = body.audio;
    mimeType    = body.mimeType || 'audio/webm';
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) };
  }

  if (!audioBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data provided' }) };
  }

  try {
    // Send audio directly to Gemini for instant, high-accuracy transcription
    const response = await fetch(`${GEMINI_TRANSCRIPTION_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(';')[0], // Clean formatting parameters if any exist
                data: audioBase64
              }
            },
            {
              text: "Transcribe the spoken audio text exactly as heard into English text. Do not correct grammar, do not add any introduction, explanations, notes, or commentary. Output ONLY the raw transcription."
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Transcription error:', response.status, errText);
      throw new Error(`Gemini Transcription responded with ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (err) {
    console.error('Transcribe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription failed' }) };
  }
};