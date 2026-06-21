import { getStore } from '@netlify/blobs'

const UNLIMITED_EMAILS = ['sarfraz.mb.ahmed2006@gmail.com']

const getBlobStore = (name) =>
  getStore({
    name,
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_API_TOKEN,
  })

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  let email, disqualified, closedEarly, messages, videoUrl
  try {
    const body   = JSON.parse(event.body || '{}')
    email        = (body.email || '').trim().toLowerCase()
    disqualified = Boolean(body.disqualified)
    closedEarly  = Boolean(body.closedEarly)
    messages     = body.messages || []
    videoUrl     = body.videoUrl || null
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) }
  }

  const isUnlimited = UNLIMITED_EMAILS.includes(email)
  const now = new Date().toISOString()

  // Clean messages
  const cleanMessages = messages
    .filter(m => m.content !== 'START_INTERVIEW')
    .map(m => ({
      ...m,
      content: (m.content || '')
        .replace(/\[TIME_WARNING\]/gi, '')
        .replace(/\[END_INTERVIEW[^\]]*\]/gi, '')
        .trim(),
    }))
    .filter(m => m.content.length > 0)

  // ==========================================
  // 🧠 NEW: SECURE GROQ AI GRADING ENGINE
  // ==========================================
  let aiRating = null;
  let aiFeedback = null;

  // Only grade them if they actually answered questions, weren't caught cheating, and the key exists
  if (!disqualified && cleanMessages.length >= 4 && process.env.GROQ_API_KEY) {
    try {
      const transcriptText = cleanMessages.map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n\n');

      const prompt = `You are a strict technical recruiter. Review the following interview transcript and evaluate the candidate's performance. 
      Return ONLY a JSON object with exactly two keys: 
      "rating": an integer from 1 to 10 scoring their technical skills and problem-solving.
      "feedback": a 2-3 sentence summary of their strengths and weaknesses.
      
      Transcript:
      ${transcriptText}`;

      // Call Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192', // Using Llama 3 70B for high-quality evaluation
          messages: [
            { role: 'system', content: 'You are an AI technical recruiter. You must return valid JSON.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2 // Keep it low for consistent, analytical grading
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0].message.content) {
         const aiEval = JSON.parse(data.choices[0].message.content);
         aiRating = aiEval.rating;
         aiFeedback = aiEval.feedback;
      }
    } catch (error) {
      console.error("Groq AI Grading Engine failed:", error);
    }
  }
  // ==========================================

  try {
    if (!isUnlimited) {
      const usedStore = getBlobStore('sj-used-emails')
      await usedStore.set(
        email,
        JSON.stringify({ used: true, completedAt: now, disqualified, closedEarly })
      )
    }

    const transcriptStore = getBlobStore('sj-interview-transcripts')
    await transcriptStore.set(
      email,
      JSON.stringify({ 
        email, 
        completedAt: now, 
        disqualified, 
        closedEarly, 
        messages: cleanMessages, 
        videoUrl,
        aiRating,     // <--- Save the AI Score
        aiFeedback    // <--- Save the AI Review
      })
    )

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('complete-interview error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save', detail: err.message }) }
  }
}