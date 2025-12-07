import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '../pages/Home'
import AgentResults from '../pages/AgentResults'
import AgentProfile from '../pages/AgentProfile'
import CreateProfile from '../pages/CreateProfile'
import Dashboard from '../pages/Dashboard'
import VideoCall from '../pages/VideoCall'
import VoiceCall from '../pages/VoiceCall'
import Contact from '../pages/Contact'
import Careers from '../pages/Careers'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import LegalNotice from '../pages/LegalNotice'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/navbar/Navbar'
import Footer from '../components/footer/Footer'

function Protected({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agents" element={<AgentResults />} />
        <Route path="/agents/:id" element={<AgentProfile />} />
        <Route
          path="/profile/create"
          element={
            <Protected>
              <CreateProfile />
            </Protected>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
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
