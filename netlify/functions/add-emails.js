// netlify/functions/add-emails.js
// Admin-only endpoint to add candidate emails to the interview whitelist
// Also handles review submissions (no auth required for reviews)

import { getStore } from '@netlify/blobs'

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

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  const { emails, adminKey } = body

  // Validate admin key
  const expectedKey = process.env.ADMIN_SECRET_KEY
  if (!expectedKey || adminKey !== expectedKey) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized — invalid admin key' }),
    }
  }

  if (!Array.isArray(emails) || emails.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No emails provided' }),
    }
  }

  // Sanitize emails
  const clean = emails
    .map((e) => (e || '').trim().toLowerCase())
    .filter((e) => e.includes('@') && e.includes('.'))

  if (clean.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No valid email addresses found' }),
    }
  }

  try {
    const store = getStore('sj-interview-whitelist')

    // Add each email (won't overwrite an already-used one)
    let added = 0
    let skipped = 0

    await Promise.all(
      clean.map(async (email) => {
        try {
          const existing = await store.get(email)
          if (existing) {
            const record = JSON.parse(existing)
            if (record.used) {
              skipped++
              return // Don't overwrite completed interviews
            }
          }
          await store.set(
            email,
            JSON.stringify({
              allowed: true,
              used: false,
              inProgress: false,
              addedAt: new Date().toISOString(),
            })
          )
          added++
        } catch (err) {
          console.error(`Failed to add ${email}:`, err)
        }
      })
    )

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        added,
        skipped,
        total: clean.length,
      }),
    }
  } catch (err) {
    console.error('add-emails error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', detail: err.message }),
    }
  }
}
