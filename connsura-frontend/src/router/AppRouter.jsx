import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '../pages/Home'
import HomeTest from '../pages/HomeTest'
import AgentResults from '../pages/AgentResults'
import AgentProfile from '../pages/AgentProfile'
import Dashboard from '../pages/Dashboard'
import ClientDashboard from '../pages/ClientDashboard'
import AgentDashboard from '../pages/AgentDashboard'
import AgentOnboarding from '../pages/AgentOnboarding'
import ClientForms from '../pages/ClientForms'
import CreateProfile from '../pages/CreateProfile'
import VideoCall from '../pages/VideoCall'
import VoiceCall from '../pages/VoiceCall'
import Contact from '../pages/Contact'
import Careers from '../pages/Careers'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import LegalNotice from '../pages/LegalNotice'
import Admin from '../pages/Admin'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/navbar/Navbar'
import Footer from '../components/footer/Footer'

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

function AgentApprovedOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'AGENT') return <Navigate to="/dashboard" replace />
  const pending = user.agentStatus && user.agentStatus !== 'approved'
  const suspended = user.agentSuspended
  if (pending || suspended) return <Navigate to="/agent/onboarding" replace />
  return children
}

function CustomerOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'CUSTOMER') return <Navigate to="/agent/dashboard" replace />
  return children
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home-test" element={<HomeTest />} />
            <Route path="/agents" element={<AgentResults />} />
            <Route path="/agents/:id" element={<AgentProfile />} />
            <Route path="/profile/create" element={<CreateProfile />} />
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
              path="/client_forms"
              element={
                <CustomerOnly>
                  <ClientForms />
                </CustomerOnly>
              }
            />
            <Route
              path="/agent/dashboard"
              element={
                <AgentApprovedOnly>
                  <AgentDashboard />
                </AgentApprovedOnly>
              }
            />
            <Route path="/agent/onboarding" element={<AgentOnboarding />} />
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
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
