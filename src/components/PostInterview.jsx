import { useState } from 'react'

const HASHTAGS = '#ScholarshipJourney #AIInterview #EdTechPakistan #MLInternship #FutureOfHiring'
const LINKEDIN_PAGE = 'https://www.linkedin.com/company/scholarship-journey-pk'
const LINKEDIN_POST_TEXT = encodeURIComponent(
  `Just completed my AI-powered interview with Scholarship Journey and it was an incredible experience! 🤖✨\n\nThe AI interviewer felt genuinely natural and conversational — honestly one of the most unique interview formats I have ever gone through.\n\nIf you are a student looking for international scholarship opportunities, check them out!\n\n${HASHTAGS}\n\n${LINKEDIN_PAGE}`
)

const EXPERIENCE_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
}

export default function PostInterview({ email }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review, setReview] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const displayRating = hoverRating || rating

  const handleSubmitReview = async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, rating, review }),
      })
    } catch {
      // Best effort — don't block the UX on this
    }
    setSubmitting(false)
    setSubmitted(true)
  }

  const handleCopyHashtags = () => {
    navigator.clipboard.writeText(HASHTAGS).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const handleLinkedInShare = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(LINKEDIN_PAGE)}&summary=${LINKEDIN_POST_TEXT}`,
      '_blank',
      'noopener,noreferrer,width=600,height=600'
    )
  }

  return (
    <div className="page" style={{ padding: '32px 16px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header card */}
        <div
          className="glass-gold fade-in-up"
          style={{ padding: '36px 36px', textAlign: 'center' }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(253,179,2,0.12)',
              border: '2px solid rgba(253,179,2,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              margin: '0 auto 20px',
              boxShadow: '0 0 40px rgba(253,179,2,0.15)',
            }}
          >
            🎉
          </div>

          <h1 style={{ marginBottom: 12 }}>Interview Complete!</h1>
          <p className="text-secondary" style={{ fontSize: '1rem', maxWidth: 420, margin: '0 auto 24px' }}>
            Thank you for taking the time to interview with Scholarship Journey. Your response has been recorded.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 24px',
              background: 'rgba(80,220,120,0.1)',
              border: '1px solid rgba(80,220,120,0.3)',
              borderRadius: 100,
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#80e8a0',
            }}
          >
            <span>✓</span>
            Only successful applicants will be contacted
          </div>
        </div>

        {/* Rating card */}
        <div
          className="glass fade-in-up"
          style={{ padding: '28px 32px', animationDelay: '0.08s' }}
        >
          <h3 style={{ marginBottom: 6 }}>Rate Your Experience</h3>
          <p className="text-secondary" style={{ fontSize: '0.88rem', marginBottom: 22 }}>
            How was your AI interview experience? Your feedback helps us improve.
          </p>

          {!submitted ? (
            <>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`star ${star <= displayRating ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    role="button"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    ★
                  </span>
                ))}
                {displayRating > 0 && (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--gold)',
                    }}
                  >
                    {EXPERIENCE_LABELS[displayRating]}
                  </span>
                )}
              </div>

              <textarea
                className="input"
                style={{ marginTop: 12, marginBottom: 16 }}
                placeholder="Share your thoughts about the AI interview... (optional)"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
              />

              <button
                className="btn btn-gold"
                onClick={handleSubmitReview}
                disabled={rating === 0 || submitting}
                style={{ minWidth: 160 }}
              >
                {submitting ? (
                  <>
                    <span className="spinner" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </>
          ) : (
            <div className="alert alert-success" style={{ fontSize: '0.92rem' }}>
              ✓ Thank you for your feedback! We appreciate you taking the time.
            </div>
          )}
        </div>

        {/* LinkedIn share card */}
        <div
          className="glass fade-in-up"
          style={{ padding: '28px 32px', animationDelay: '0.16s' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(10,102,194,0.2)',
                border: '1px solid rgba(10,102,194,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                flexShrink: 0,
              }}
            >
              💼
            </div>
            <div>
              <h3 style={{ marginBottom: 4 }}>Share on LinkedIn</h3>
              <p className="text-secondary" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                You just experienced AI-powered hiring — something most people have never seen.
                Share it on LinkedIn and tag us to help others discover Scholarship Journey!
              </p>
            </div>
          </div>

          {/* Preview of post */}
          <div
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              marginBottom: 16,
              whiteSpace: 'pre-line',
            }}
          >
            {`Just completed my AI-powered interview with Scholarship Journey and it was an incredible experience! 🤖✨

The AI interviewer felt genuinely natural and conversational — honestly one of the most unique interview formats I have ever gone through.

If you are a student looking for international scholarship opportunities, check them out!`}
            <div style={{ marginTop: 10, color: 'var(--gold)', fontWeight: 600, fontSize: '0.78rem' }}>
              {HASHTAGS}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="linkedin-btn" onClick={handleLinkedInShare}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Share on LinkedIn
            </button>

            <button className="btn btn-ghost" onClick={handleCopyHashtags} style={{ fontSize: '0.88rem' }}>
              {copied ? '✓ Copied!' : '# Copy Hashtags'}
            </button>

            <a
              href={LINKEDIN_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: '0.88rem', textDecoration: 'none' }}
            >
              Follow Our Page
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div className="sj-logo" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <div className="sj-logo-icon" style={{ width: 32, height: 32, fontSize: '0.85rem', borderRadius: 8 }}>
              SJ
            </div>
            <div className="sj-logo-text" style={{ fontSize: '0.95rem' }}>
              Scholarship <span>Journey</span>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.75rem' }}>
            Empowering Pakistani students to access world-class education · scholarshipjourney.pk
          </p>
        </div>
      </div>
    </div>
  )
}
