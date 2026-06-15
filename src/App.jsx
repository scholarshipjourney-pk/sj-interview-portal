import { useState, useEffect } from 'react'
import EmailGate from './components/EmailGate.jsx'
import Instructions from './components/Instructions.jsx'
import Interview from './components/Interview.jsx'
import PostInterview from './components/PostInterview.jsx'
import AdminPanel from './components/AdminPanel.jsx'

// Background floating dots
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
  INTERVIEW: 'interview',
  POST: 'post',
}

export default function App() {
  const [stage, setStage] = useState(STAGES.EMAIL)
  const [candidateEmail, setCandidateEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  // Check for admin route
  useEffect(() => {
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
    setStage(STAGES.INTERVIEW)
  }

  const handleInterviewEnd = () => {
    setStage(STAGES.POST)
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
          {stage === STAGES.EMAIL && (
            <EmailGate onVerified={handleEmailVerified} />
          )}
          {stage === STAGES.INSTRUCTIONS && (
            <Instructions
              email={candidateEmail}
              onStart={handleInterviewStart}
            />
          )}
          {stage === STAGES.INTERVIEW && (
            <Interview
              email={candidateEmail}
              onComplete={handleInterviewEnd}
            />
          )}
          {stage === STAGES.POST && (
            <PostInterview email={candidateEmail} />
          )}
        </>
      )}
    </>
  )
}
