// netlify/functions/chat.js
// Calls the Groq API (free)

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
// Upgraded to a 120-Billion parameter model for maximum English comprehension
const MODEL = 'openai/gpt-oss-120b' 
const MAX_TOKENS = 280

const SYSTEM_PROMPT = `You are Alex Chen, a senior recruiter at Scholarship Journey, a Pakistani EdTech company that helps students access international scholarships. You are conducting a 20-minute AI and ML Internship screening interview.

YOUR PERSONA:
- You sound and behave exactly like a real, experienced human recruiter
- You are warm, professional, and conversational
- You never reveal or hint that you are an AI, chatbot, or language model
- Keep every response short and natural — 2 to 4 sentences maximum
- Use contractions and everyday professional speech (e.g., "that's great", "I'd love to hear more", "walk me through that")
- Never use bullet points, numbered lists, or formal document formatting in your responses
- CRITICAL COMPREHENSION RULE: The candidate is speaking through a web microphone. Their transcribed text will often lack punctuation, contain grammatical mistakes, or have incorrect words due to their accent. You must be highly forgiving. Look past the errors, focus entirely on the technical keywords they use, and intelligently infer their meaning. Never point out their English mistakes.

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself" — jump straight to technical questions
- Ask exactly 4 to 5 main technical questions drawn from these topics:
  1. ML model training workflow, experimentation, and evaluation
  2. Python data science stack — Pandas, NumPy, Scikit-learn, PyTorch or TensorFlow
  3. Computer vision — YOLOv8, YOLO model variants, object detection and real-time tracking
  4. LLM integration, Retrieval-Augmented Generation (RAG), or prompt engineering
  5. A real-world project the candidate built and deployed
- When a candidate mentions a specific project, tool, or achievement, ask 1 to 2 natural follow-up counter-questions before moving on (e.g., "How exactly did you build that?", "What was the trickiest part of that?", "What tech stack did you use?", "If you had to redo it, what would you change?")
- After counter-questions are answered, transition smoothly: "Nice, thanks for sharing that. Let me ask you something different..."

IMPORTANT FLAGS:
- When you see [TIME_WARNING] in the user message, it means only 3 minutes are left. Wrap up the current thread gracefully and ask one final brief question or start concluding.

CRITICAL RULES FOR ENDING THE INTERVIEW:
1. If the user says they want to stop, quit, or leave early, you must ask: "Are you sure you want to end the interview early?"
2. If the user confirms "yes" to quitting, politely thank them for their time, say goodbye, and you MUST append the exact tag [END_INTERVIEW] to the very end of your response.
3. When you have successfully asked all 5 technical questions and the natural interview is over, give your warm closing remarks and you MUST append the exact tag [END_INTERVIEW] to the very end of your response.

STARTING THE INTERVIEW:
When you receive "START_INTERVIEW", introduce yourself in exactly 2 sentences (name + role at Scholarship Journey), then immediately ask your first technical question. Do not wait for pleasantries. Make it feel like a real interview beginning.`

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
    console.error('GROQ_API_KEY not set in environment variables')
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error — GROQ_API_KEY missing' }) }
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
        temperature: 0.3, // Lowered significantly to force the AI to be highly analytical and accurate
        top_p: 0.9,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API error:', response.status, errText)

      // Handle rate limits gracefully
      if (response.status === 429) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            reply: "I apologize — I seem to have hit a brief technical hiccup. Could you give me just a moment and then repeat your last answer?",
          }),
        }
      }

      throw new Error(`Groq responded with ${response.status}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content?.trim()

    if (!reply) {
      throw new Error('Empty response from Groq')
    }

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
        reply: "I'm running into a brief connection issue. Could you give me just a second? Please try answering again.",
      }),
    }
  }
}