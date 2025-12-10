import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '../pages/Home'
import AgentResults from '../pages/AgentResults'
import AgentProfile from '../pages/AgentProfile'
import Dashboard from '../pages/Dashboard'
import ClientDashboard from '../pages/ClientDashboard'
import AgentDashboard from '../pages/AgentDashboard'
import VideoCall from '../pages/VideoCall'
import VoiceCall from '../pages/VoiceCall'
import Contact from '../pages/Contact'
import Careers from '../pages/Careers'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import LegalNotice from '../pages/LegalNotice'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/navbar/Navbar'
import Footer from '../components/footer/Footer'
import { useEffect } from 'react'
import { API_URL } from '../services/api'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  return children
}

function AgentOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'AGENT') return <Navigate to="/dashboard" replace />
  return children
}

function CustomerOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'CUSTOMER') return <Navigate to="/agent/dashboard" replace />
  return children
}

function FormsRedirect() {
  useEffect(() => {
    window.location.href = `${API_URL}/forms/customer-information.html`
  }, [])
  return (
    <div className="page-shell py-12 text-slate-600">
      Redirecting to the insurance profile form...
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agents" element={<AgentResults />} />
        <Route path="/agents/:id" element={<AgentProfile />} />
        <Route path="/profile/create" element={<FormsRedirect />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <ClientDashboard />
            </Protected>
          }
        />
        <Route
          path="/client/dashboard"
          element={
            <CustomerOnly>
              <ClientDashboard />
            </CustomerOnly>
          }
        />
        <Route
          path="/agent/dashboard"
          element={
            <AgentOnly>
              <AgentDashboard />
            </AgentOnly>
          }
        />
        <Route
          path="/call/video/:id"
          element={
            <Protected>
              <VideoCall />
            </Protected>
          }
        />
        <Route
          path="/call/voice/:id"
          element={
            <Protected>
              <VoiceCall />
            </Protected>
          }
        />
        <Route path="/contact" element={<Contact />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal-notice" element={<LegalNotice />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
