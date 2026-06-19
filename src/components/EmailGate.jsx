import { useState } from 'react'

// Simple robot/AI SVG icon
function RobotIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="20" width="32" height="28" rx="6" fill="rgba(253,179,2,0.25)" stroke="#FDB302" strokeWidth="2"/>
      <rect x="24" y="28" width="6" height="6" rx="2" fill="#FDB302"/>
      <rect x="34" y="28" width="6" height="6" rx="2" fill="#FDB302"/>
      <rect x="26" y="38" width="12" height="3" rx="1.5" fill="#FDB302" opacity="0.7"/>
      <rect x="29" y="12" width="6" height="10" rx="3" fill="rgba(253,179,2,0.5)" stroke="#FDB302" strokeWidth="1.5"/>
      <circle cx="32" cy="11" r="3" fill="#FDB302"/>
      <rect x="8" y="26" width="6" height="12" rx="3" fill="rgba(253,179,2,0.3)" stroke="#FDB302" strokeWidth="1.5"/>
      <rect x="50" y="26" width="6" height="12" rx="3" fill="rgba(253,179,2,0.3)" stroke="#FDB302" strokeWidth="1.5"/>
    </svg>
  )
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export default function EmailGate({ onVerified }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setError('Please enter your email address.'); return }
    if (!isValidEmail(trimmed)) { setError('Please enter a valid email address (e.g. name@example.com).'); return }

    // ---- ONE-TIME ACCESS CHECK ----
    const completedEmail = localStorage.getItem('sj_interview_completed_email')
    const isAdmin = trimmed === 'sarfraz.mb.ahmed2006@gmail.com'
    
    if (completedEmail && completedEmail.toLowerCase() === trimmed && !isAdmin) {
      setError('This email has already been used for an interview on this device. Each candidate gets one attempt only.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()

      if (data.allowed) {
        onVerified(trimmed)
      } else if (data.reason === 'already_used') {
        setError('This email has already been used for an interview. Each candidate gets one attempt only.')
      } else if (data.reason === 'not_whitelisted') {
        setError('This email is not on the invite list. Please check your invitation email or contact careers@scholarshipjourney.pk')
      } else {
        setError('Something went wrong. Please try again in a moment.')
      }
    } catch {
      setError('Connection error. Please check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div
        className="glass-gold fade-in-up"
        style={{ width: '100%', maxWidth: 460, padding: '44px 40px', textAlign: 'center' }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <img
            src="/logo.png"
            alt="Scholarship Journey"
            style={{ height: 60, width: 'auto', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div className="sj-logo" style={{ justifyContent: 'center', display: 'none' }}>
            <div className="sj-logo-icon">SJ</div>
            <div className="sj-logo-text">Scholarship <span>Journey</span></div>
          </div>
        </div>

        {/* Robot icon */}
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: 'rgba(253,179,2,0.1)', border: '1px solid rgba(253,179,2,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <RobotIcon />
        </div>

        <h1 style={{ fontSize: '1.55rem', marginBottom: 6 }}>AI Interview Portal</h1>
        <p className="text-secondary" style={{ fontSize: '0.88rem', marginBottom: 30 }}>
          AI and ML Internship Screening · Scholarship Journey
        </p>

        {/* Email input */}
        <div style={{ textAlign: 'left', marginBottom: 18 }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.55)', marginBottom: 7,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Your Invitation Email
          </label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>
        )}

        <button
          className="btn btn-gold"
          style={{ width: '100%', fontSize: '1rem', padding: '15px 32px' }}
          onClick={handleSubmit}
          disabled={loading || !email.trim()}
        >
          {loading ? <><span className="spinner" /> Verifying...</> : <>Enter Interview Portal</>}
        </button>

        <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: 20, lineHeight: 1.65 }}>
          Only candidates who received an invitation email may access this portal.
          Each email address gets exactly one attempt.
        </p>
      </div>

      <p className="text-muted" style={{ fontSize: '0.72rem', marginTop: 22, textAlign: 'center' }}>
        &copy; {new Date().getFullYear()} Scholarship Journey · Powered by AI
      </p>
    </div>
  )
}