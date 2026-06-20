import { useState, useEffect, useRef } from 'react'

const RULES = [
  {
    icon: '🎯',
    bg: 'rgba(253,179,2,0.12)',
    title: '4 to 5 Technical Questions',
    desc: 'The AI interviewer asks focused questions about ML workflows, computer vision, Python data science, LLM integration, and real-world project experience.',
  },
  {
    icon: '⏱️',
    bg: 'rgba(100,180,255,0.1)',
    title: '20 Minute Time Limit',
    desc: 'The interview runs for exactly 20 minutes and ends automatically. Give clear, focused answers and manage your time well.',
  },
  {
    icon: '🧕',
    bg: 'rgba(80,220,120,0.1)',
    title: 'No Clothing Restrictions',
    desc: 'Female candidates are fully welcome and encouraged to wear Islamic dress, coats, hijabs, niqabs, or face masks. We are an inclusive team.',
  },
  {
    icon: '🚫',
    bg: 'rgba(255,80,80,0.1)',
    title: 'Zero Tolerance Anti-Cheating',
    desc: 'The system monitors tab switching and window focus. Switching tabs or closing the window will immediately end and disqualify your interview.',
  },
  {
    icon: '🎙️',
    bg: 'rgba(180,100,255,0.1)',
    title: 'Speak Your Answers',
    desc: 'The AI interviewer will speak to you. Reply using your microphone. If your browser does not support voice input, a text option appears automatically.',
  },
  {
    icon: '📵',
    bg: 'rgba(255,150,0,0.1)',
    title: 'One Attempt Only',
    desc: 'This is your single opportunity. Once the interview begins it cannot be restarted. Make sure your internet connection is stable before proceeding.',
  },
]

export default function Instructions({ email, onStart }) {
  const [camGranted,  setCamGranted]  = useState(false)
  const [micGranted,  setMicGranted]  = useState(false)
  const [permError,   setPermError]   = useState('')
  const [requesting,  setRequesting]  = useState(false)
  const [camStream,   setCamStream]   = useState(null)
  const videoRef = useRef(null)

  // Set srcObject after React renders the video element
  useEffect(() => {
    if (camStream && videoRef.current) {
      videoRef.current.srcObject = camStream
    }
  }, [camStream, camGranted])

  useEffect(() => {
    return () => {
      if (camStream) camStream.getTracks().forEach(t => t.stop())
    }
  }, [camStream])

  const requestPermissions = async () => {
    setRequesting(true)
    setPermError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: true,
      })
      setCamGranted(true)
      setMicGranted(true)
      setCamStream(stream)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPermError('Camera and microphone access was denied. Click the lock icon in your browser address bar, allow both, then refresh the page.')
      } else if (err.name === 'NotFoundError') {
        setPermError('No camera or microphone detected. Please connect one and refresh the page.')
      } else {
        setPermError('Could not access camera or microphone. Please try again or use a different browser.')
      }
    } finally {
      setRequesting(false)
    }
  }

  const bothGranted = camGranted && micGranted

  return (
    <div className="page" style={{ padding: '24px 16px', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div className="glass-gold fade-in-up" style={{ padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
            src="/logo.png"
            alt="Scholarship Journey"
            style={{ height: 40, width: 'auto', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div className="sj-logo-icon" style={{ display: 'none' }}>SJ</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>AI Interview Portal</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>AI and ML Internship Screening</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Signed in as</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)' }}>{email}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Left: Rules */}
          <div className="glass fade-in-up" style={{ padding: '24px 22px', animationDelay: '0.05s' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 18 }}>Interview Rules</h2>
            <div>
              {RULES.map((rule, i) => (
                <div className="rule-item" key={i}>
                  <div className="rule-icon" style={{ background: rule.bg }}>{rule.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.87rem', marginBottom: 3 }}>{rule.title}</div>
                    <div style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{rule.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Permissions + Camera */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Permission cards */}
            <div className="glass fade-in-up" style={{ padding: '22px 22px', animationDelay: '0.1s' }}>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 18 }}>Camera and Microphone</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {[
                  { icon: '📷', label: 'Camera', sub: 'Required for the interview', ok: camGranted },
                  { icon: '🎙️', label: 'Microphone', sub: 'Required to answer questions', ok: micGranted },
                ].map(item => (
                  <div key={item.label} className={`perm-item ${item.ok ? 'granted' : permError ? 'denied' : ''}`}>
                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: item.ok ? '#80e8a0' : permError ? '#ff8080' : 'var(--text-muted)' }}>
                      {item.ok ? 'Granted' : permError ? 'Denied' : 'Pending'}
                    </div>
                  </div>
                ))}
              </div>

              {permError && (
                <div className="alert alert-error" style={{ marginBottom: 14, fontSize: '0.8rem' }}>{permError}</div>
              )}

              {!bothGranted && (
                <button className="btn btn-ghost" style={{ width: '100%' }} onClick={requestPermissions} disabled={requesting}>
                  {requesting ? <><span className="spinner" /> Requesting...</> : 'Allow Camera and Microphone'}
                </button>
              )}
            </div>

            {/* Camera preview */}
            <div className="glass fade-in-up" style={{ padding: '18px 22px', animationDelay: '0.14s' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                Camera Preview
              </div>
              <div className="camera-preview">
                {bothGranted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '1.8rem' }}>📷</span>
                    <span style={{ fontSize: '0.78rem' }}>Preview will appear here</span>
                  </div>
                )}
              </div>
              {bothGranted && (
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#80e8a0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Looking great! You are ready to start.
                </div>
              )}
            </div>

            {/* Start button */}
            <button
              className={`btn fade-in-up ${bothGranted ? 'btn-gold' : 'btn-ghost'}`}
              style={{ width: '100%', padding: '16px', fontSize: '1rem', animationDelay: '0.18s' }}
              onClick={onStart}
              disabled={!bothGranted}
            >
              {bothGranted ? 'Start Interview' : 'Allow Camera and Mic to Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
