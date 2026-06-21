import { useState } from 'react'

const LINKEDIN_PAGE   = 'https://www.linkedin.com/company/scholarshipjourney-pk/'
const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VajjhBTHwXbGSzJ3Jg1c'

// No em dashes, Scholarship Journey tagged with their page URL
const POST_TEXT = `Just completed my AI-powered interview with Scholarship Journey and it was an incredible experience!

The AI interviewer felt genuinely natural and conversational, honestly one of the most unique interview formats I have ever gone through.

If you are a student looking for international scholarship opportunities, check out Scholarship Journey: ${LINKEDIN_PAGE}

#ScholarshipJourney #AIInterview #EdTechPakistan #MLInternship #FutureOfHiring`

const EXPERIENCE_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' }

// WhatsApp SVG icon
function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// LinkedIn SVG icon
function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

export default function PostInterview({ email }) {
  const [rating,     setRating]     = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review,     setReview]     = useState('')
  const [submitted,  setSubmitted]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [shareMsg,   setShareMsg]   = useState('')

  const displayRating = hoverRating || rating

  const handleSubmitReview = async () => {
    const savedEmail = localStorage.getItem('sj_interview_completed_email') || email;
    if (rating === 0 || !savedEmail) return
    
    setSubmitting(true)
    try {
      await fetch('/.netlify/functions/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: savedEmail, 
          rating: rating, 
          review: review 
        }),
      })
    } catch (error) {
      console.error('Failed to submit review', error)
    }
    setSubmitting(false)
    setSubmitted(true)
  }

  // New function just for copying the text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(POST_TEXT)
      setShareMsg('Post text copied! You can now paste it into your LinkedIn post.')
      setTimeout(() => setShareMsg(''), 4000)
    } catch {
      setShareMsg('Failed to copy. Please manually select and copy the text.')
    }
  }

  // Simplified LinkedIn share function
  const handleLinkedInShare = () => {
    setShareMsg('Opening LinkedIn... paste the copied text to create your post.')
    setTimeout(() => setShareMsg(''), 5000)
    window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer')
  }

  const handleWhatsApp = () => {
    window.open(WHATSAPP_CHANNEL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="page" style={{ padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Success header */}
        <div className="glass-gold fade-in-up" style={{ padding: '36px 36px', textAlign: 'center' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'rgba(253,179,2,0.12)', border: '2px solid rgba(253,179,2,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', margin: '0 auto 20px',
            boxShadow: '0 0 40px rgba(253,179,2,0.15)',
          }}>
            🎉
          </div>

          <h1 style={{ marginBottom: 10 }}>Interview Complete!</h1>
          <p className="text-secondary" style={{ fontSize: '0.95rem', maxWidth: 400, margin: '0 auto 24px' }}>
            Thank you for your time. Your interview has been recorded and our team will review all responses carefully.
          </p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 22px',
            background: 'rgba(80,220,120,0.1)', border: '1px solid rgba(80,220,120,0.3)',
            borderRadius: 100, fontSize: '0.87rem', fontWeight: 600, color: '#80e8a0',
          }}>
            <span>✓</span>
            Only successful applicants will be contacted
          </div>
        </div>

        {/* Rating */}
        <div className="glass fade-in-up" style={{ padding: '26px 32px', animationDelay: '0.08s' }}>
          <h3 style={{ marginBottom: 5 }}>Rate Your Experience</h3>
          <p className="text-secondary" style={{ fontSize: '0.86rem', marginBottom: 20 }}>
            How was your AI interview experience? Your honest feedback helps us improve.
          </p>

          {!submitted ? (
            <>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    className={`star ${star <= displayRating ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    role="button"
                    tabIndex={0}
                  >
                    ★
                  </span>
                ))}
                {displayRating > 0 && (
                  <span style={{ marginLeft: 10, fontSize: '0.87rem', fontWeight: 600, color: 'var(--gold)' }}>
                    {EXPERIENCE_LABELS[displayRating]}
                  </span>
                )}
              </div>

              <textarea
                className="input"
                style={{ marginTop: 12, marginBottom: 16 }}
                placeholder="Share your thoughts about the AI interview experience... (optional)"
                value={review}
                onChange={e => setReview(e.target.value)}
                rows={3}
              />

              <button
                className="btn btn-gold"
                onClick={handleSubmitReview}
                disabled={rating === 0 || submitting}
                style={{ minWidth: 160 }}
              >
                {submitting ? <><span className="spinner" /> Submitting...</> : 'Submit Feedback'}
              </button>
            </>
          ) : (
            <div className="alert alert-success" style={{ fontSize: '0.9rem' }}>
              Thank you for your feedback! We really appreciate it.
            </div>
          )}
        </div>

        {/* Share section */}
        <div className="glass fade-in-up" style={{ padding: '26px 32px', animationDelay: '0.16s' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'rgba(10,102,194,0.2)', border: '1px solid rgba(10,102,194,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', flexShrink: 0,
            }}>
              📣
            </div>
            <div>
              <h3 style={{ marginBottom: 4 }}>Share Your Experience</h3>
              <p className="text-secondary" style={{ fontSize: '0.83rem', lineHeight: 1.6 }}>
                You just experienced AI-powered hiring, something most people have never seen.
                Share it and help other Pakistani students discover Scholarship Journey!
              </p>
            </div>
          </div>

          {/* Post text preview */}
          <div style={{
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, 
            padding: '14px 16px 46px 16px', /* Added extra bottom padding to make room */
            fontSize: '0.81rem', color: 'var(--text-secondary)', lineHeight: 1.7,
            marginBottom: 16, whiteSpace: 'pre-line', position: 'relative'
          }}>
            <button
              onClick={handleCopyText}
              style={{
                position: 'absolute', bottom: 12, right: 12, /* Moved to bottom right */
                background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: 6, padding: '6px 10px',
                color: 'var(--text-white)', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              📋 Copy
            </button>

            {`Just completed my AI-powered interview with Scholarship Journey and it was an incredible experience!

The AI interviewer felt genuinely natural and conversational, honestly one of the most unique interview formats I have ever gone through.

If you are a student looking for international scholarship opportunities, check out Scholarship Journey!`}
            <div style={{ marginTop: 10, color: 'var(--gold)', fontWeight: 600, fontSize: '0.77rem' }}>
              #ScholarshipJourney #AIInterview #EdTechPakistan #MLInternship #FutureOfHiring
            </div>
          </div>

          {shareMsg && (
            <div className="alert alert-success" style={{ marginBottom: 14, fontSize: '0.83rem' }}>
              {shareMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {/* LinkedIn share */}
            <button className="linkedin-btn" onClick={handleLinkedInShare} style={{ flex: 1, padding: '12px 4px', fontSize: '0.85rem', justifyContent: 'center', whiteSpace: 'nowrap' }}>
              <LinkedInIcon />
              Share on LinkedIn
            </button>

            {/* WhatsApp follow */}
            <button
              onClick={handleWhatsApp}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 4px',
                background: '#25D366', color: '#fff',
                borderRadius: 100, fontWeight: 600, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(37,211,102,0.3)',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#20b858'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'none' }}
            >
              <WhatsAppIcon />
              Follow on WhatsApp
            </button>

            {/* LinkedIn follow */}
            <a
              href={LINKEDIN_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="linkedin-btn"
              style={{ flex: 1, padding: '12px 4px', fontSize: '0.85rem', justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <LinkedInIcon />
              Follow on LinkedIn
            </a>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            When sharing on LinkedIn, paste the copied text and tag <strong style={{ color: 'var(--text-secondary)' }}>@Scholarship Journey</strong> so we can reshare your post.
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <img
            src="/logo.png"
            alt="Scholarship Journey"
            style={{ height: 44, width: 'auto', objectFit: 'contain', marginBottom: 10 }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
          />
          <div className="sj-logo" style={{ justifyContent: 'center', display: 'none', marginBottom: 10 }}>
            <div className="sj-logo-icon" style={{ width: 30, height: 30, fontSize: '0.8rem', borderRadius: 7 }}>SJ</div>
            <div className="sj-logo-text" style={{ fontSize: '0.9rem' }}>Scholarship <span>Journey</span></div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.74rem' }}>
            Empowering Pakistani students to access world-class education.{' '}
            <a href="https://scholarshipjourney.pk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              scholarshipjourney.pk
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}