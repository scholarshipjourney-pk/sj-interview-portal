import MicCheck from './components/MicCheck.jsx'
import { useState, useEffect } from 'react'
import EmailGate from './components/EmailGate.jsx'
import Instructions from './components/Instructions.jsx'
import Interview from './components/Interview.jsx'
import PostInterview from './components/PostInterview.jsx'
import AdminPanel from './components/AdminPanel.jsx'

function FloatingDots() {
  const dots = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 3,
    left: Math.random() * 100,
    delay: Math.random() * 20,
    duration: Math.random() * 20 + 18,
  }))

  return (
    <>
      {dots.map(dot => (
        <div
          key={dot.id}
          className="bg-dot"
          style={{
            width: dot.size,
            height: dot.size,
            left: `${dot.left}%`,
            bottom: '-20px',
            animationDuration: `${dot.duration}s`,
            animationDelay: `${dot.delay}s`,
          }}
        />
      ))}
    </>
  )
}

const STAGES = {
  EMAIL: 'email',
  INSTRUCTIONS: 'instructions',
  MICCHECK: 'miccheck',
  INTERVIEW: 'interview',
  POST: 'post',
}

// Robust Mobile/Tablet Detector (Catches "Desktop Site" requests too)
function isMobileOrTablet() {
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchScreen = ('maxTouchPoints' in navigator) && (navigator.maxTouchPoints > 0);
  const isSmallScreen = window.innerWidth <= 1024;
  return isMobileUA || (isTouchScreen && isSmallScreen);
}

export default function App() {
  const [stage, setStage] = useState(STAGES.EMAIL)
  const [candidateEmail, setCandidateEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  useEffect(() => {
    if (isMobileOrTablet()) {
      setIsMobileDevice(true)
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('admin') === 'true') {
      setIsAdmin(true)
    }
  }, [])

  const handleEmailVerified = (email) => {
    setCandidateEmail(email)
    setStage(STAGES.INSTRUCTIONS)
  }

  const handleInterviewStart = () => {
    setStage(STAGES.MICCHECK)
  }

  const handleInterviewEnd = () => {
    setStage(STAGES.POST)
  }

  // Block Mobile Users Early
  if (isMobileDevice && !isAdmin) {
    return (
      <>
        <div className="app-bg"><FloatingDots /></div>
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="glass-gold fade-in-up" style={{ textAlign: 'center', padding: '44px 40px', maxWidth: 480, width: '100%' }}>
            <img src="/logo.png" alt="Scholarship Journey" style={{ height: 44, width: 'auto', objectFit: 'contain', marginBottom: 24 }} onError={e => e.target.style.display = 'none'} />
            <h2 style={{ marginBottom: 12 }}>💻 Laptop / PC Required</h2>
            <p className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
              Our AI interview platform requires a stable desktop environment, camera, and continuous microphone access to process your responses properly. 
              <br /><br />
              <strong>Please open this link on a Laptop or Desktop computer to proceed with your interview.</strong>
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="app-bg">
        <FloatingDots />
      </div>

      {isAdmin ? (
        <AdminPanel />
      ) : (
        <>
          {stage === STAGES.EMAIL && <EmailGate onVerified={handleEmailVerified} />}
          {stage === STAGES.INSTRUCTIONS && <Instructions email={candidateEmail} onStart={handleInterviewStart} />}
          {stage === STAGES.MICCHECK && <MicCheck onPass={() => setStage(STAGES.INTERVIEW)} />}
          {stage === STAGES.INTERVIEW && <Interview email={candidateEmail} onComplete={handleInterviewEnd} />}
          {stage === STAGES.POST && <PostInterview email={candidateEmail} />}
        </>
      )}
    </>
  )
}