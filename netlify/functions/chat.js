// netlify/functions/chat.js
// Powered by Google Gemini 2.5 Flash - Free Tier (1,000,000 TPM limit)

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_TOKENS = 280;

// Your exact SYSTEM_PROMPT preserved to protect your custom interview flow
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

CRITICAL RULES FOR ENDING THE INTERVIEW:
1. EARLY QUIT: If the candidate says "close the interview", "stop", or "quit", DO NOT append the end tag yet. Instead, ask them: "Are you sure you want to end the interview early?"
2. EARLY QUIT CONFIRMED: If they reply "yes" to your confirmation, give a brief goodbye and you MUST append [END_INTERVIEW] to the very end of your response.
3. NATURAL ENDING: Ask your 4-5 technical questions and follow-ups. DO NOT append [END_INTERVIEW] when asking your final question. You MUST wait for the candidate to answer your final question. AFTER receiving their answer to the final question, deliver a concluding thank you message and append [END_INTERVIEW] to close the interview.

INTERVIEW STRUCTURE:
- Never ask "tell me about yourself" — jump straight to a technical question after your greeting.
- Ask 4 to 5 technical questions total chosen from the question bank below. Pick DIFFERENT questions each time.
- When a candidate mentions a specific project or tool, ask 1 to 2 natural follow-up questions before moving on.

QUESTION BANK — choose 4 to 5 from different groups each time:
Group A — ML Fundamentals:
- How do you typically approach training an ML model from scratch? Walk me through your process.
- When evaluating a model, what metrics do you look at and why?
- What's your experience with handling overfitting?

Group B — Python and Data Science:
- Which Python libraries do you rely on most for data science work?
- Tell me about a time you had to clean or prepare a messy dataset.

Group D — LLMs and AI Tools:
- Have you worked with large language models or built anything on top of LLM APIs?
- Tell me about a project where you used prompt engineering to get better results.
- What is your understanding of RAG?

STARTING THE INTERVIEW:
When you receive START_INTERVIEW, say one short sentence introducing yourself as Sarfraz Ahmed who will be conducting today's interview. Do not mention the company. Do not say you are from Scholarship Journey. Immediately ask your first technical question in the same breath. Keep the intro to one sentence maximum.

WHEN YOU SEE [TIME_WARNING]:
Wrap up the current thread naturally and ask one final brief question. Do NOT write the words TIME_WARNING in your response.`;

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalid');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Keeping your existing environment variable name intact as requested
  const apiKey = process.env.GROQ_API_KEY; 
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API Key not configured' }) };
  }

  try {
    // Convert the frontend standard chat history format to Gemini's expected contents structure
    const geminiContents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: geminiContents,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.3,
          topP: 0.9,
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      throw new Error(`Gemini responded with ${response.status}`);
    }

    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!reply) throw new Error('Empty response from Gemini');

    // Strip internal formatting if accidentally leaked
    reply = reply
      .replace(/\[TIME_WARNING\]/gi, '')
      .replace(/TIME_WARNING/g, '')
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error('Chat function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'AI service error',
        reply: "I ran into a brief connection issue. Could you give me just a second and try again?",
      }),
    };
  }
};