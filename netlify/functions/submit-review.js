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

  let email, rating, review
  try {
    const body = JSON.parse(event.body || '{}')
    email  = (body.email  || '').trim().toLowerCase()
    rating = Number(body.rating) || 0
    review = (body.review || '').trim().slice(0, 1000) // cap at 1000 chars
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!email || rating < 1 || rating > 5) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid data' }) }
  }

  try {
    // 1. Save to your original reviews database
    const reviewStore = getStore('sj-interview-reviews')
    await reviewStore.setJSON(email, {
      email,
      rating,
      review,
      submittedAt: new Date().toISOString(),
    })

    // 2. ALSO attach it to the main transcript so the Admin Panel sees it!
    const transcriptStore = getStore('sj-interview-transcripts')
    const existingDataString = await transcriptStore.get(email)
    
    if (existingDataString) {
      let existingData = JSON.parse(existingDataString)
      // Save it as candidateRating so it doesn't overwrite the AI's technical rating
      existingData.candidateRating = rating
      existingData.candidateFeedback = review
      await transcriptStore.setJSON(email, existingData)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('submit-review error:', err)
    // Don't fail the UX over a review save error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    }
  }
}