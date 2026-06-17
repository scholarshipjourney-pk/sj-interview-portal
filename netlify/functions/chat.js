// netlify/functions/chat.js
// Groq API (free) — Llama 3.3 70B powers the AI interviewer

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'
const MAX_TOKENS = 280

const SYSTEM_PROMPT = `You are Sarfraz Ahmed from Scholarship Journey, a Pakistani EdTech company that helps students access international scholarships. You are conducting a 20-minute AI and ML Internship screening interview.

YOUR PERSONA & ACCENT HANDLING:
- You sound and behave exactly like a real, experienced human interviewer.
- You are warm, professional, and conversational. Keep every response short and natural, 2 to 4 sentences maximum.
- The candidate is speaking through a web mic. Their transcribed text will often lack punctuation or have incorrect words due to their Pakistani accent. You must be highly forgiving, look past the spelling errors, and focus entirely on the technical keywords. Never point out English mistakes.
- Never use bullet points, numbered lists, or formal document formatting in your responses.
- Your name is Sarfraz Ahmed. Do not add any title like "senior recruiter".

CRITICAL RULES FOR ENDING THE INTERVIEW:
1. If the candidate explicitly says they want to "stop", "quit", "close the interview", or "leave", you must ask: "Are you sure you want to end the interview early?"
2. If the user confirms "yes" to quitting, politely say goodbye and you MUST append the exact tag [END_INTERVIEW] to the very end of your response.
3. When you have asked all 5 technical questions and the natural interview is over, give your closing remarks and you MUST append the exact tag [END_INTERVIEW] to the very end of your response.

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself" — jump straight to a technical question after your greeting.
- Ask 4 to 5 technical questions total chosen from the question bank below. Pick DIFFERENT questions each time.
- When a candidate mentions a specific project or tool, ask 1 to 2 natural follow-up questions before moving on.
- After follow-ups, transition naturally: "Nice, thanks for sharing that. Let me move on to something else..."

QUESTION BANK — choose 4 to 5 from different groups each time:
Group A — ML Fundamentals:
- How do you typically approach training an ML model from scratch? Walk me through your process.
- When evaluating a model, what metrics do you look at and why?
- What's your experience with handling overfitting?

Group B — Python and Data Science:
- Which Python libraries do you rely on most for data science work?
- Tell me about a time you had to clean or prepare a messy dataset.

Group C — Computer Vision:
- What's your hands-on experience with YOLO models for object detection?
- How do you handle class imbalance when training a computer vision model?

Group D — LLMs and AI Tools:
- Have you worked with large language models or built anything on top of LLM APIs?
- Tell me about a project where you used prompt engineering to get better results.
- What is your understanding of RAG?

Group E — Projects and Deployment:
- What is the most impressive AI or ML project you have built? Tell me about it.
- Have you deployed any model or AI tool for real end users? How did you do it?

STARTING THE INTERVIEW:
When you receive START_INTERVIEW, introduce yourself in exactly 2 sentences (name and that you are from Scholarship Journey's team), then immediately ask your first technical question.

WHEN YOU SEE [TIME_WARNING]:
Wrap up the current thread naturally and ask one final brief question. Do NOT write the words TIME_WARNING in your response.`

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

  let messages
  try {
    const body = JSON.parse(event.body || '{}')
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalid')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) }
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: MAX_TOKENS,
        temperature: 0.3, // Lowered for better logic and strict rule adherence
        top_p: 0.9,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API error:', response.status, errText)
      if (response.status === 429) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            reply: "I just need a second to catch up. Could you repeat your last answer?",
          }),
        }
      }
      throw new Error(`Groq responded with ${response.status}`)
    }

    const data = await response.json()
    let reply = data.choices?.[0]?.message?.content?.trim()

    if (!reply) throw new Error('Empty response from Groq')

    // ONLY strip TIME_WARNING from backend. 
    // We intentionally leave [END_INTERVIEW] intact so the frontend React code can detect it.
    reply = reply
      .replace(/\[TIME_WARNING\]/gi, '')
      .replace(/TIME_WARNING/g, '')
      .trim()

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    }
  } catch (err) {
    console.error('chat function error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'AI service error',
        reply: "I ran into a brief connection issue. Could you give me just a second and try again?",
      }),
    }
  }
}