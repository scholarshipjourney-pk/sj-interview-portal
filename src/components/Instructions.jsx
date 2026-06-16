import { useState, useEffect, useRef } from 'react'

const RULES = [
  {
    icon: '🎯',
    bg: 'rgba(253,179,2,0.12)',
    title: '4 to 5 Technical Questions',
    desc: 'The AI interviewer will ask you focused questions about ML workflows, computer vision, Python data science, LLM integration, and real-world project experience.',
  },
  {
    icon: '⏱️',
    bg: 'rgba(100,180,255,0.1)',
    title: '20 Minute Time Limit',
    desc: 'The interview runs for exactly 20 minutes. The AI will wrap up gracefully as time runs out. Manage your time and give clear, focused answers.',
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
    desc: 'The system silently monitors eye contact, tab switching, and window focus. Use of external tools or leaving the page will result in disqualification without any warning.',
  },
  {
    icon: '🎙️',
    bg: 'rgba(180,100,255,0.1)',
    title: 'Speak Your Answers',
    desc: 'The AI interviewer will speak to you. Reply using your microphone. If your browser does not support voice, a text input option will appear automatically.',
  },
  {
    icon: '📵',
    bg: 'rgba(255,150,0,0.1)',
    title: 'One Attempt Only',
    desc: 'This is your single opportunity. Once the interview begins it cannot be restarted. Make sure your internet connection is stable before proceeding.',
  },
]

export default function Instructions({ email, onStart }) {
  const [camGranted, setCamGranted] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [permError, setPermError] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [camStream, setCamStream] = useState(null)
  const videoRef = useRef(null)

  const bothGranted = camGranted && micGranted

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (camStream) camStream.getTracks().forEach((t) => t.stop())
    }
  }, [camStream])

  // FIX: Attach stream to the video element AFTER React finishes rendering it
  useEffect(() => {
    if (bothGranted && camStream && videoRef.current) {
      videoRef.current.srcObject = camStream
    }
  }, [bothGranted, camStream])

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
      // Removed the immediate srcObject assignment here to fix the timing bug
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPermError(
          'Camera and microphone access was denied. Please click the lock icon in your browser address bar and allow both, then refresh the page.'
        )
      } else if (err.name === 'NotFoundError') {
        setPermError(
          'No camera or microphone detected. Please connect a webcam and microphone and refresh the page.'
        )
      } else {
        setPermError('Could not access camera or microphone. Please try again or use a different browser.')
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="page" style={{ padding: '24px 16px', alignItems: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div
          className="glass-gold fade-in-up"
          style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 20 }}
        >
          <div className="sj-logo">
            <div className="sj-logo-icon">SJ</div>
            <div className="sj-logo-text">
              Scholarship <span>Journey</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
              Signed in as
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--gold)' }}>
              {email}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Rules */}
          <div
            className="glass fade-in-up"
            style={{ padding: '28px 24px', animationDelay: '0.05s' }}
          >
            <h2 style={{ fontSize: '1.15rem', marginBottom: 20 }}>
              📋 Interview Rules
            </h2>
            <div>
              {RULES.map((rule, i) => (
                <div className="rule-item" key={i}>
                  <div className="rule-icon" style={{ background: rule.bg }}>
                    {rule.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 3 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {rule.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Permissions + Camera */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              className="glass fade-in-up"
              style={{ padding: '28px 24px', animationDelay: '0.1s' }}
            >
              <h2 style={{ fontSize: '1.15rem', marginBottom: 20 }}>
                🔒 Camera &amp; Microphone
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div
                  className={`perm-item ${camGranted ? 'granted' : permError ? 'denied' : ''}`}
                >
                  <span style={{ fontSize: '1.3rem' }}>📷</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Camera</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Required for the interview
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: camGranted ? '#80e8a0' : permError ? '#ff8080' : 'var(--text-muted)',
                    }}
                  >
                    {camGranted ? 'Granted' : permError ? 'Denied' : 'Pending'}
                  </div>
                </div>

                <div
                  className={`perm-item ${micGranted ? 'granted' : permError ? 'denied' : ''}`}
                >
                  <span style={{ fontSize: '1.3rem' }}>🎙️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Microphone</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Required to answer questions
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: micGranted ? '#80e8a0' : permError ? '#ff8080' : 'var(--text-muted)',
                    }}
                  >
                    {micGranted ? 'Granted' : permError ? 'Denied' : 'Pending'}
                  </div>
                </div>
              </div>

              {permError && (
                <div className="alert alert-error" style={{ marginBottom: 16, fontSize: '0.82rem' }}>
                  {permError}
                </div>
              )}

              {!bothGranted && (
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%' }}
                  onClick={requestPermissions}
                  disabled={requesting}
                >
                  {requesting ? (
                    <>
                      <span className="spinner" /> Requesting access...
                    </>
                  ) : (
                    <>🔓 Allow Camera &amp; Mic</>
                  )}
                </button>
              )}
            </div>

            {/* Camera preview */}
            <div
              className="glass fade-in-up"
              style={{ padding: '20px 24px', animationDelay: '0.15s' }}
            >
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 12,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Camera Preview
              </div>
              <div className="camera-preview">
                {bothGranted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>📷</span>
                    <span style={{ fontSize: '0.8rem' }}>Preview will appear here</span>
                  </div>
                )}
              </div>
              {bothGranted && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: '0.8rem',
                    color: '#80e8a0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>✓</span>
                  Looking great! You are ready to start.
                </div>
              )}
            </div>

            {/* Start button */}
            <button
              className="btn btn-gold fade-in-up"
              style={{
                width: '100%',
                padding: '16px 32px',
                fontSize: '1.05rem',
                animationDelay: '0.2s',
              }}
              onClick={onStart}
              disabled={!bothGranted}
            >
              {bothGranted ? (
                <>
                  Start Interview
                  <span style={{ fontSize: '1.2rem' }}>🚀</span>
                </>
              ) : (
                'Allow Camera and Mic to Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}