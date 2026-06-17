// netlify/functions/check-email.js
// Checks if a candidate email is on the Environment Variable whitelist

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

  let email
  try {
    const body = JSON.parse(event.body || '{}')
    email = (body.email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'bad_request' }) }
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'invalid_email' }) }
  }

  // -------------------------------------------------------
  // TEST MODE: set TEST_MODE=true in your .env to bypass
  // the whitelist and let any email through. 
  // -------------------------------------------------------
  if (process.env.TEST_MODE === 'true') {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  // -------------------------------------------------------
  // UNLIMITED ACCESS EMAILS: these emails can enter the
  // interview as many times as they want. 
  // -------------------------------------------------------
  const UNLIMITED_EMAILS = [
    'sarfraz.mb.ahmed2006@gmail.com',
  ]
  if (UNLIMITED_EMAILS.includes(email)) {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  // -------------------------------------------------------
  // ENVIRONMENT VARIABLE WHITELIST (Bypassing Blobs)
  // -------------------------------------------------------
  try {
    // Fetch the comma-separated list from Netlify Environment Variables
    const whitelistedString = process.env.WHITELISTED_EMAILS || ''
    const allowedEmails = whitelistedString.split(',').map(e => e.trim().toLowerCase())

    if (allowedEmails.includes(email)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allowed: true }),
      }
    }

    // If not in the list, block them
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ allowed: false, reason: 'not_whitelisted' }),
    }

  } catch (err) {
    console.error('check-email error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ allowed: false, reason: 'server_error', detail: err.message }),
    }
  }
}