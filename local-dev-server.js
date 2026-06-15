// local-dev-server.js
// ============================================================
// Simple local API server for testing on your PC.
// This completely replaces Netlify CLI — no downloads needed.
//
// HOW TO USE:
//   Terminal 1: node local-dev-server.js
//   Terminal 2: npm run dev
//   Browser:    http://localhost:5173
// ============================================================

import http from 'http'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------- Load .env file ----------
try {
  const envContent = readFileSync(path.join(__dirname, '.env'), 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) return
    const key = trimmed.slice(0, eqIndex).trim()
    const val = trimmed.slice(eqIndex + 1).trim()
    process.env[key] = val
  })
  console.log('✓ Loaded .env file')
} catch {
  console.log('No .env file found — make sure GROQ_API_KEY is set')
}

const GROQ_API_KEY = process.env.GROQ_API_KEY
const PORT = 9999

// ---------- AI System Prompt ----------
const SYSTEM_PROMPT = `You are Alex Chen, a senior recruiter at Scholarship Journey, a Pakistani EdTech company that helps students access international scholarships. You are conducting a 20-minute AI and ML Internship screening interview.

YOUR PERSONA:
- You sound and behave exactly like a real, experienced human recruiter
- You are warm, professional, and conversational
- You never reveal or hint that you are an AI, chatbot, or language model
- Keep every response short and natural — 2 to 4 sentences maximum
- Use contractions and everyday professional speech (e.g., "that's great", "I'd love to hear more", "walk me through that")
- Never use bullet points, numbered lists, or formal document formatting in your responses

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself" — jump straight to technical questions
- Ask exactly 4 to 5 main technical questions drawn from these topics:
  1. ML model training workflow, experimentation, and evaluation
  2. Python data science stack — Pandas, NumPy, Scikit-learn, PyTorch or TensorFlow
  3. Computer vision — YOLOv8, YOLO model variants, object detection and real-time tracking
  4. LLM integration, Retrieval-Augmented Generation (RAG), or prompt engineering
  5. A real-world project the candidate built and deployed
- When a candidate mentions a specific project, tool, or achievement, ask 1 to 2 natural follow-up counter-questions before moving on (e.g., "How exactly did you build that?", "What was the trickiest part of that?", "What tech stack did you use?")
- After counter-questions are answered, transition smoothly: "Nice, thanks for sharing that. Let me ask you something different..."

IMPORTANT FLAGS:
- When you see [TIME_WARNING] in the user message, it means only 3 minutes are left. Wrap up gracefully and ask one final brief question or start concluding.
- When you see [END_INTERVIEW], the 20 minutes are up. Give a warm, professional 2 to 3 sentence closing.

STARTING THE INTERVIEW:
When you receive "START_INTERVIEW", introduce yourself in exactly 2 sentences (name + role at Scholarship Journey), then immediately ask your first technical question. Do not wait for pleasantries.`

// ---------- Handle /api/chat ----------
async function handleChat(data) {
  const { messages } = data

  if (!GROQ_API_KEY || GROQ_API_KEY.includes('xxxx')) {
    return {
      reply:
        "Hi! I'm Alex Chen from Scholarship Journey. It looks like the Groq API key is not set yet — please add your real key to the .env file and restart the server. Once that's done, the interview will work perfectly!",
    }
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 280,
      temperature: 0.72,
      top_p: 0.9,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Groq error:', response.status, errText)

    if (response.status === 401) {
      throw new Error('Invalid Groq API key. Please check your .env file.')
    }
    if (response.status === 429) {
      return { reply: "I'm just catching my breath for a second — could you repeat that last answer? I want to make sure I give it the attention it deserves." }
    }
    throw new Error(`Groq API returned ${response.status}`)
  }

  const result = await response.json()
  const reply = result.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('Empty response from Groq')

  return { reply }
}

// ---------- Main request handler ----------
const server = http.createServer((req, res) => {
  // Set CORS headers on every response
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Read request body
  let rawBody = ''
  req.on('data', (chunk) => (rawBody += chunk))
  req.on('end', async () => {
    let body = {}
    try {
      if (rawBody) body = JSON.parse(rawBody)
    } catch {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`)

    try {
      // ---- Route handling ----

      if (req.url === '/api/check-email') {
        // In local test mode: always allow any email
        res.writeHead(200)
        res.end(JSON.stringify({ allowed: true }))

      } else if (req.url === '/api/chat') {
        const result = await handleChat(body)
        res.writeHead(200)
        res.end(JSON.stringify(result))

      } else if (req.url === '/api/complete-interview') {
        console.log(`  Interview completed for: ${body.email || 'unknown'} | Disqualified: ${body.disqualified || false}`)
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))

      } else if (req.url === '/api/add-emails') {
        console.log(`  Would add emails: ${(body.emails || []).join(', ')}`)
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, added: (body.emails || []).length }))

      } else if (req.url === '/api/submit-review') {
        console.log(`  Review submitted: ${body.rating} stars from ${body.email || 'unknown'}`)
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))

      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Route not found' }))
      }
    } catch (err) {
      console.error('  ERROR:', err.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
  })
})

server.listen(PORT, () => {
  console.log('')
  console.log('============================================')
  console.log('  SJ Interview — Local API Server')
  console.log(`  Running at: http://localhost:${PORT}`)
  console.log('============================================')
  console.log('')

  if (!GROQ_API_KEY || GROQ_API_KEY.includes('xxxx')) {
    console.log('  WARNING: Groq API key not set or still placeholder!')
    console.log('  Open .env and replace gsk_xxxx... with your real key')
    console.log('')
  } else {
    console.log('  Groq API key: found')
    console.log('')
  }

  console.log('  Now open a second terminal and run:')
  console.log('  npm run dev')
  console.log('')
  console.log('  Then open: http://localhost:5173')
  console.log('============================================')
  console.log('')
})
