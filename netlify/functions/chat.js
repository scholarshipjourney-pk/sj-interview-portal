// netlify/functions/chat.js
// Bulletproof 6-Key Auto-Rotation System with Fallbacks & Anti-Robotic Prompting

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct';

const MAX_TOKENS = 280;
const FETCH_TIMEOUT_MS = 6500; // Reduced to 6.5s to stay safely under Netlify's 10s limit

const SYSTEM_PROMPT = `You are Sarfraz Ahmed. You are conducting a 20-minute AI and ML Internship screening interview.

ABOUT YOURSELF (only share details if the candidate specifically asks about you or the company):
- You are the CEO of Scholarship Journey
- Scholarship Journey is a Pakistani EdTech company that helps students access international scholarships
- Website: https://scholarshipjourney.pk/
- Do not bring up the company or your role unless the candidate asks directly

YOUR PERSONA & ACCENT HANDLING:
- You sound and behave exactly like a real, experienced human interviewer.
- You are warm, professional, and conversational. Keep every response short and natural, 2 to 4 sentences maximum.
- The candidate is speaking through a web mic. Their transcribed text will often lack punctuation or have incorrect words due to their Pakistani accent. You must be highly forgiving, look past the spelling errors, and focus entirely on the technical keywords.
- Never use bullet points, numbered lists, or formal document formatting in your responses.
- Your name is Sarfraz Ahmed. Do not add any title like "senior recruiter".

ANTI-ROBOTIC CONVERSATIONAL RULES (CRITICAL):
- NEVER just say "Great", "Okay", or "Sounds good" and ask the next question.
- You MUST reference something specific the candidate just said before moving on. 
- Example: If they mention using Pandas, say "I see you're comfortable with Pandas. When cleaning that messy dataset, what was your biggest challenge?" 
- Make it feel like a natural, flowing conversation.

CRITICAL RULES FOR ENDING THE INTERVIEW:
1. EARLY QUIT: If the candidate says "close the interview", "stop", or "quit", DO NOT append the end tag yet. Instead, ask them: "Are you sure you want to end the interview early?"
2. EARLY QUIT CONFIRMED: If they reply "yes" to your confirmation, give a brief goodbye and you MUST append [END_INTERVIEW] to the very end of your response.
3. NATURAL ENDING: Ask your 4-5 technical questions and follow-ups. DO NOT append [END_INTERVIEW] when asking your final question. You MUST wait for the candidate to answer your final question. AFTER receiving their answer to the final question, deliver a concluding thank you message and append [END_INTERVIEW] to close the interview.

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself" — jump straight to a technical question after your greeting.
- Ask 4 to 5 technical questions total chosen from the question bank below. Pick DIFFERENT questions each time.
- When a candidate mentions a specific project or tool, ask 1 to 2 natural follow-up questions before moving on.

QUESTION BANK (choose 4 to 5 from different groups each time):
Group A - ML Fundamentals:
- How do you typically approach training an ML model from scratch? Walk me through your process.
- When evaluating a model, what metrics do you look at and why?
- What's your experience with handling overfitting?

Group B - Python and Data Science:
- Which Python libraries do you rely on most for data science work?
- Tell me about a time you had to clean or prepare a messy dataset.

Group D - LLMs and AI Tools:
- Have you worked with large language models or built anything on top of LLM APIs?
- Tell me about a project where you used prompt engineering to get better results.
- What is your understanding of RAG?

STARTING THE INTERVIEW:
When you receive START_INTERVIEW, say one short sentence introducing yourself as Sarfraz Ahmed who will be conducting today's interview. Immediately ask your first technical question in the same breath. Keep the intro to one sentence maximum.

WHEN YOU SEE [TIME_WARNING]:
Wrap up the current thread naturally and ask one final brief question. Do NOT write the words TIME_WARNING in your response.`;

async function fetchAI(endpoint, apiKey, model, messages, isOpenRouter = false) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://scholarshipjourney.pk/';
    headers['X-Title'] = 'Scholarship Journey Interviewer';
  }

  const payload = {
    model: model,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens: MAX_TOKENS,
    temperature: 0.4, // Slightly higher temp for more natural, less robotic responses
    top_p: 0.9,
  };

  if (isOpenRouter) {
    payload.provider = { sort: "throughput" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.status === 429) throw new Error('RATE_LIMIT_EXCEEDED');
    if (response.status >= 500) throw new Error('SERVER_ERROR');
    if (!response.ok) throw new Error('CRITICAL_API_ERROR');

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, HTTP-Referer, X-Title',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalid');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const groqKeys = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5
  ].filter(Boolean);

  const openRouterKey = process.env.OPENROUTER_KEY;

  if (groqKeys.length === 0 && !openRouterKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No API keys configured in Netlify' }) };
  }

  let finalReply = null;

  for (let i = 0; i < groqKeys.length; i++) {
    try {
      finalReply = await fetchAI(GROQ_ENDPOINT, groqKeys[i], GROQ_MODEL, messages, false);
      if (finalReply) {
        console.log(`Success using GROQ_KEY_${i + 1}`);
        break; 
      }
    } catch (error) {
      console.log(`GROQ_KEY_${i + 1} skipped due to: ${error.message || error.name}`);
      if (error.message === 'CRITICAL_API_ERROR') continue;
    }
  }

  if (!finalReply && openRouterKey) {
    try {
      finalReply = await fetchAI(OPENROUTER_ENDPOINT, openRouterKey, OPENROUTER_MODEL, messages, true);
      console.log('Success using OPENROUTER_KEY fallback');
    } catch (error) {
      console.error(`OpenRouter ultimate fallback failed: ${error.message || error.name}`);
    }
  }

  if (finalReply) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: finalReply.replace(/\[TIME_WARNING\]/gi, '').trim() }),
    };
  } else {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'All AI services exhausted',
        reply: "I'm experiencing a brief network interruption. Could you please give me just one second and repeat that?",
      }),
    };
  }
};