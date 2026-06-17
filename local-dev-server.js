// local-dev-server.js
// ============================================================
// Simple local API server — replaces Netlify CLI entirely.
// No extra packages needed, pure Node.js.
//
// HOW TO USE:
//   Terminal 1: node local-dev-server.js
//   Terminal 2: npm run dev
//   Browser:    http://localhost:5173
// ============================================================

import http from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Load .env ----
try {
  const env = readFileSync(path.join(__dirname, '.env'), 'utf-8')
  env.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  })
  console.log('  Loaded .env file')
} catch { console.log('  No .env file found') }

const GROQ_API_KEY   = process.env.GROQ_API_KEY  || ''
const ADMIN_KEY      = process.env.ADMIN_SECRET_KEY
const PORT           = 9999
const UNLIMITED      = ['sarfraz.mb.ahmed2006@gmail.com']

// ---- Simple file-based storage (replaces Netlify Blobs locally) ----
const STORE_DIR = path.join(__dirname, '.local-store')
if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true })

function storeGet(store, key) {
  try {
    const file = path.join(STORE_DIR, `${store}_${key.replace(/[^a-z0-9@._-]/gi, '_')}.json`)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null
  } catch { return null }
}

function storeSet(store, key, value) {
  const file = path.join(STORE_DIR, `${store}_${key.replace(/[^a-z0-9@._-]/gi, '_')}.json`)
  writeFileSync(file, JSON.stringify(value, null, 2))
}

function storeList(store) {
  try {
    const { readdirSync } = await import('fs')
    // Sync approach
    const { readdirSync: rd } = readFileSync
    return []
  } catch { return [] }
}

function storeListSync(store) {
  try {
    const { readdirSync } = { readdirSync: (d) => require('fs').readdirSync(d) }
    // Use readFileSync module approach
    const files = readDirStore(store)
    return files.map(f => f.replace(`${store}_`, '').replace('.json', '').replace(/_/g, '.'))
  } catch { return [] }
}

function readDirStore(store) {
  try {
    const { readdirSync } = { readdirSync: null }
    // Pure sync read of directory
    const dirents = []
    // We'll use a different approach — just track emails in a master list
    const masterFile = path.join(STORE_DIR, `_master_${store}.json`)
    if (!existsSync(masterFile)) return []
    return JSON.parse(readFileSync(masterFile, 'utf-8'))
  } catch { return [] }
}

function masterAdd(store, key) {
  const masterFile = path.join(STORE_DIR, `_master_${store}.json`)
  let list = []
  if (existsSync(masterFile)) {
    try { list = JSON.parse(readFileSync(masterFile, 'utf-8')) } catch {}
  }
  if (!list.includes(key)) {
    list.push(key)
    writeFileSync(masterFile, JSON.stringify(list))
  }
}

function masterList(store) {
  const masterFile = path.join(STORE_DIR, `_master_${store}.json`)
  if (!existsSync(masterFile)) return []
  try { return JSON.parse(readFileSync(masterFile, 'utf-8')) } catch { return [] }
}

// ---- AI System Prompt ----
const SYSTEM_PROMPT = `You are Sarfraz Ahmed from Scholarship Journey, a Pakistani EdTech company that helps students access international scholarships. You are conducting a 20-minute AI and ML Internship screening interview.

YOUR PERSONA:
- You sound and behave exactly like a real, experienced human interviewer
- You are warm, professional, and conversational
- You NEVER reveal or hint that you are an AI, chatbot, or language model
- Keep every response short and natural, 2 to 4 sentences maximum
- Use contractions and everyday professional speech
- Never use bullet points, numbered lists, or formal document formatting

CRITICAL RULES ABOUT INTERNAL FLAGS:
- You MUST NEVER write, repeat, say, or include [TIME_WARNING] or [END_INTERVIEW] anywhere in your response text
- If you see [TIME_WARNING], just start wrapping up naturally
- If you see [END_INTERVIEW], give a warm closing without mentioning the flag

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself"
- Ask 4 to 5 technical questions from the question bank, picking different ones each time
- When a candidate mentions a specific project, ask 1 to 2 natural follow-up questions

QUESTION BANK:
Group A: ML model training workflow, evaluation metrics, overfitting, cross-validation
Group B: Python libraries (Pandas, NumPy, Scikit-learn), dataset cleaning, data visualization
Group C: YOLOv8, object detection, real-time tracking, class imbalance
Group D: LLM APIs, RAG implementation, prompt engineering, fine-tuning
Group E: Best project built, deployment experience, experiment tracking tools

STARTING: When you receive START_INTERVIEW, introduce yourself as Sarfraz Ahmed from Scholarship Journey in 2 sentences, then immediately ask your first technical question.

WHEN YOU SEE [TIME_WARNING]: Wrap up naturally and ask one final question.
WHEN YOU SEE [END_INTERVIEW]: Give a warm 2 to 3 sentence closing. Thank the candidate sincerely.`

// ---- Groq API call ----
async function callGroq(messages) {
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('xxxx')) {
    return "Hi! I'm Sarfraz Ahmed from Scholarship Journey. It looks like the Groq API key is not set yet in your .env file. Please add your real key from console.groq.com and restart this server."
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 280,
      temperature: 0.75,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    console.error('  Groq error:', res.status, txt.slice(0, 200))
    if (res.status === 429) return "I just need a second to catch up. Could you repeat that?"
    throw new Error(`Groq ${res.status}`)
  }

  const data = await res.json()
  let reply = data.choices?.[0]?.message?.content?.trim() || ''
  // Strip any internal flags the model accidentally echoed
  reply = reply.replace(/\[TIME_WARNING\]/gi, '').replace(/\[END_INTERVIEW[^\]]*\]/gi, '').trim()
  return reply
}

// ---- Routes ----
async function handleRequest(url, body) {
  if (url === '/api/check-email') {
    const email = (body.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) return { allowed: false, reason: 'invalid_email' }
    if (process.env.TEST_MODE === 'true') return { allowed: true }
    if (UNLIMITED.includes(email)) return { allowed: true }
    const record = storeGet('whitelist', email)
    if (!record?.allowed) return { allowed: false, reason: 'not_whitelisted' }
    if (record.used) return { allowed: false, reason: 'already_used' }
    storeSet('whitelist', email, { ...record, inProgress: true, startedAt: new Date().toISOString() })
    return { allowed: true }
  }

  if (url === '/api/chat') {
    const reply = await callGroq(body.messages || [])
    return { reply }
  }

  if (url === '/api/complete-interview') {
    const email = (body.email || '').trim().toLowerCase()
    if (!email) return { success: false }
    const isUnlimited = UNLIMITED.includes(email)
    const record = storeGet('whitelist', email) || {}
    storeSet('whitelist', email, {
      ...record,
      used: isUnlimited ? false : true,
      inProgress: false,
      completedAt: new Date().toISOString(),
      disqualified: Boolean(body.disqualified),
      closedEarly: Boolean(body.closedEarly),
    })
    // Save transcript
    const msgs = (body.messages || [])
      .filter(m => m.content !== 'START_INTERVIEW')
      .map(m => ({ ...m, content: m.content.replace(/\[TIME_WARNING\]/gi, '').replace(/\[END_INTERVIEW[^\]]*\]/gi, '').trim() }))
      .filter(m => m.content.length > 0)
    storeSet('transcripts', email, { email, completedAt: new Date().toISOString(), disqualified: body.disqualified, closedEarly: body.closedEarly, messages: msgs })
    masterAdd('whitelist', email)
    masterAdd('transcripts', email)
    console.log(`  Interview saved for: ${email} | Disqualified: ${body.disqualified} | Closed early: ${body.closedEarly}`)
    return { success: true }
  }

  if (url === '/api/add-emails') {
    if (body.adminKey !== ADMIN_KEY) return { error: 'Unauthorized', status: 401 }
    const emails = (body.emails || []).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'))
    let added = 0, skipped = 0
    for (const email of emails) {
      const existing = storeGet('whitelist', email)
      if (existing?.used) { skipped++; continue }
      storeSet('whitelist', email, { allowed: true, used: false, inProgress: false, addedAt: new Date().toISOString() })
      masterAdd('whitelist', email)
      added++
    }
    return { success: true, added, skipped, total: emails.length }
  }

  if (url === '/api/get-results') {
    if (body.adminKey !== ADMIN_KEY) return { error: 'Unauthorized', status: 401 }
    if (body.email) {
      const email = body.email.trim().toLowerCase()
      return {
        email,
        status:     storeGet('whitelist',    email),
        transcript: storeGet('transcripts',  email),
        review:     storeGet('reviews',      email),
      }
    }
    const emails = masterList('whitelist')
    const results = emails.map(email => {
      const record = storeGet('whitelist', email) || {}
      const review = storeGet('reviews',   email)
      return { email, ...record, review }
    })
    results.sort((a, b) => (b.completedAt || '') > (a.completedAt || '') ? 1 : -1)
    return { results }
  }

  if (url === '/api/submit-review') {
    const email = (body.email || '').trim().toLowerCase()
    if (email && body.rating) {
      storeSet('reviews', email, { email, rating: body.rating, review: body.review || '', submittedAt: new Date().toISOString() })
      masterAdd('reviews', email)
      console.log(`  Review: ${body.rating}/5 from ${email}`)
    }
    return { success: true }
  }

  return { error: 'Not found', status: 404 }
}

// ---- HTTP server ----
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  let raw = ''
  req.on('data', chunk => raw += chunk)
  req.on('end', async () => {
    let body = {}
    try { if (raw) body = JSON.parse(raw) } catch {}

    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`)

    try {
      const result = await handleRequest(req.url, body)
      const status = result.status || 200
      if (result.status) delete result.status
      res.writeHead(status)
      res.end(JSON.stringify(result))
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
  console.log(`  Running on: http://localhost:${PORT}`)
  console.log('============================================')
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('xxxx')) {
    console.log('  WARNING: Groq API key not set!')
    console.log('  Edit .env and add your real GROQ_API_KEY')
  } else {
    console.log('  Groq API key: found')
  }
  console.log('')
  console.log('  Now open a second terminal and run:')
  console.log('    npm run dev')
  console.log('  Then open: http://localhost:5173')
  console.log('  Admin panel: http://localhost:5173/?admin=true')
  console.log('============================================')
  console.log('')
})
