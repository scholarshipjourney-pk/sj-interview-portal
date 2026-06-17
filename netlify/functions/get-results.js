// netlify/functions/get-results.js
// Admin endpoint to view all interview results and transcripts

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

  let adminKey, email
  try {
    const body = JSON.parse(event.body || '{}')
    adminKey = body.adminKey
    email    = (body.email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const whitelist   = getStore('sj-interview-whitelist')
    const transcripts = getStore('sj-interview-transcripts')
    const reviews     = getStore('sj-interview-reviews')

    // If a specific email requested, return just that transcript
    if (email) {
      let transcript = null
      let review = null
      let status = null

      try { const r = await whitelist.get(email); if (r) status = JSON.parse(r) } catch {}
      try { const r = await transcripts.get(email); if (r) transcript = JSON.parse(r) } catch {}
      try { const r = await reviews.get(email); if (r) review = JSON.parse(r) } catch {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ email, status, transcript, review }),
      }
    }

    // List all candidates
    let allEmails = []
    try {
      const listed = await whitelist.list()
      allEmails = (listed.blobs || []).map(b => b.key)
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) }
    }

    const results = await Promise.all(
      allEmails.map(async (em) => {
        let status = {}
        let review = null

        try { const r = await whitelist.get(em); if (r) status = JSON.parse(r) } catch {}
        try { const r = await reviews.get(em); if (r) review = JSON.parse(r) } catch {}

        return { email: em, ...status, review }
      })
    )

    // Sort: completed first, then in-progress, then not started
    results.sort((a, b) => {
      if (a.completedAt && !b.completedAt) return -1
      if (!a.completedAt && b.completedAt) return 1
      if (a.startedAt && !b.startedAt) return -1
      return 0
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results }),
    }
  } catch (err) {
    console.error('get-results error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
