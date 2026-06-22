import { useState, useRef, useEffect } from 'react'

function getBestAudioMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of types) {
    try { if (MediaRecorder.isTypeSupported(type)) return type } catch {}
  }
  return ''
}

export default function MicCheck({ onPass }) {
  const [status, setStatus]       = useState('idle')
  // idle | countdown | recording | processing | playback | passed | error
  const [countdown, setCountdown] = useState(5)
  const [audioURL, setAudioURL]   = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')

  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const streamRef     = useRef(null)
  const countdownRef  = useRef(null)
  const audioRef      = useRef(null)

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioURL) URL.revokeObjectURL(audioURL)
    }
  }, [])

  const startTest = async () => {
    setErrorMsg('')
    setAudioURL(null)
    setStatus('countdown')
    setCountdown(5)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch {
      setStatus('error')
      setErrorMsg('Microphone access was denied. Please allow mic access in your browser and try again.')
      return
    }

    let count = 5
    countdownRef.current = setInterval(() => {
      count--
      setCountdown(count)
      if (count <= 0) {
        clearInterval(countdownRef.current)
        startRecording(stream)
      }
    }, 1000)
  }

  const startRecording = (stream) => {
    chunksRef.current = []
    const mimeType = getBestAudioMimeType()
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstart = () => setStatus('recording')

    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      const url  = URL.createObjectURL(blob)
      setAudioURL(url)
      setStatus('playback')
    }

    recorder.start()
    recorderRef.current = recorder

    // Auto-stop after 5 seconds
    setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
    }, 5000)
  }

  const playback = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
    }
  }

  const statusConfig = {
    idle:       { icon: '🎙️', label: 'Click to test your microphone' },
    countdown:  { icon: '⏳', label: `Get ready... recording in ${countdown}` },
    recording:  { icon: '🔴', label: 'Recording for 5 seconds... speak now' },
    playback:   { icon: '🔊', label: 'Click "Play Recording" to hear yourself' },
    error:      { icon: '⚠️', label: errorMsg },
  }

  return (
    <div className="page">
      <div className="glass-gold fade-in-up" style={{ width: '100%', maxWidth: 480, padding: '44px 40px', textAlign: 'center' }}>

        <img 
          src="/logo.png" 
          alt="Scholarship Journey"
          style={{ 
            height: 44, 
            width: 'auto', 
            objectFit: 'contain', 
            marginBottom: 24,
            imageRendering: '-webkit-optimize-contrast', 
            transform: 'translateZ(0)' 
          }}
          onError={e => { e.target.style.display = 'none' }} 
        />

        <h2 style={{ marginBottom: 8 }}>Microphone Check</h2>
        <p className="text-secondary" style={{ fontSize: '0.88rem', marginBottom: 32, lineHeight: 1.6 }}>
          Before the interview starts, let us make sure your microphone is working properly.
          You will record 5 seconds of audio and then play it back to confirm.
        </p>

        {/* Status display - Hidden during playback to remove redundancy */}
        {status !== 'playback' && (
          <div style={{
            padding: '20px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 14,
            marginBottom: 28,
            minHeight: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: '2rem' }}>
              {statusConfig[status]?.icon}
            </div>
            <div style={{
              fontSize: '0.88rem',
              color: status === 'error' ? '#ff8080' : status === 'recording' ? '#ff6060' : 'var(--text-secondary)',
              fontWeight: status === 'recording' ? 600 : 400,
            }}>
              {statusConfig[status]?.label}
            </div>
            {status === 'recording' && (
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                <div style={{ height: '100%', background: '#ff6060', borderRadius: 2, animation: 'timerBar 5s linear forwards' }} />
              </div>
            )}
          </div>
        )}

        {/* Hidden audio player */}
        {audioURL && <audio ref={audioRef} src={audioURL} style={{ display: 'none' }} />}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {(status === 'idle' || status === 'error') && (
            <button className="btn btn-gold" style={{ width: '100%' }} onClick={startTest}>
              Start Mic Test
            </button>
          )}

          {status === 'playback' && (
            <>
              <button className="btn btn-gold" style={{ width: '100%' }} onClick={playback}>
                Play Recording
              </button>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={startTest}>
                Test Again
              </button>
              <button
                className="btn"
                style={{ width: '100%', background: '#80e8a0', color: '#0d1e30', fontWeight: 700 }}
                onClick={() => {
                  // FIX: Unlock iOS Safari Audio Context on user tap
                  try {
                    const unlock = new SpeechSynthesisUtterance('')
                    unlock.volume = 0
                    window.speechSynthesis.speak(unlock)
                  } catch (e) {}
                  onPass()
                }}
              >
                Sounds Good, Start Interview
              </button>
            </>
          )}

          {(status === 'countdown' || status === 'recording') && (
            <button className="btn btn-ghost" style={{ width: '100%', opacity: 0.5 }} disabled>
              Please wait...
            </button>
          )}
        </div>

        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 20, lineHeight: 1.6 }}>
          If you cannot hear yourself, check that the correct microphone is selected in your browser or system settings.
        </p>
      </div>

      <style>{`
        @keyframes timerBar {
          from { width: 100% }
          to   { width: 0% }
        }
      `}</style>
    </div>
  )
}