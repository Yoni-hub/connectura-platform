import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import Home from '../pages/Home'
import AgentResults from '../pages/AgentResults'
import AgentProfile from '../pages/AgentProfile'
import ClientDashboard from '../pages/ClientDashboard'
import AgentDashboard from '../pages/AgentDashboard'
import AgentOnboarding from '../pages/AgentOnboarding'
import CreateProfile from '../pages/CreateProfile'
import Contact from '../pages/Contact'
import About from '../pages/About'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import LegalNotice from '../pages/LegalNotice'
import Terms from '../pages/Terms'
import Privacy from '../pages/Privacy'
import DataSharing from '../pages/DataSharing'
import AgentResponsibilities from '../pages/AgentResponsibilities'
import Admin from '../pages/Admin'
import ShareProfile from '../pages/ShareProfile'
import AccountRecovery from '../pages/AccountRecovery'
import AccountDeleted from '../pages/AccountDeleted'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/navbar/Navbar'
import Footer from '../components/footer/Footer'
import LegalConsentModal from '../components/modals/LegalConsentModal'
import ErrorBoundary from '../components/ui/ErrorBoundary'

function Protected({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

function AgentOnly({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'AGENT') return <Navigate to="/dashboard" replace />
  return children
}

function AgentApprovedOnly({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'AGENT') return <Navigate to="/dashboard" replace />
  const pending = user.agentStatus && user.agentStatus !== 'approved'
  const suspended = user.agentSuspended
  if (pending || suspended) return <Navigate to="/agent/onboarding" replace />
  return children
}

function CustomerOnly({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'CUSTOMER') return <Navigate to="/agent/dashboard" replace />
  return children
}

function MessagesRedirect() {
  const { user, authReady } = useAuth()
  const location = useLocation()
  const params = useParams()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />

  const searchParams = new URLSearchParams(location.search)
  if (params.conversationId) {
    searchParams.set('conversationId', params.conversationId)
  }
  searchParams.set('tab', 'messages')

  const target =
    user.role === 'AGENT' ? '/agent/dashboard' : user.role === 'CUSTOMER' ? '/client/dashboard' : '/dashboard'
  return <Navigate to={`${target}?${searchParams.toString()}`} replace />
}

function Layout() {
  const location = useLocation()
  const footerHiddenOnMobile =
    location.pathname === '/client/dashboard' ||
    location.pathname === '/dashboard' ||
    location.pathname === '/agent/dashboard' ||
    location.pathname.startsWith('/messages')

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <LegalConsentModal />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<AgentResults />} />
          <Route path="/agents/:id" element={<AgentProfile />} />
          <Route path="/profile/create" element={<CreateProfile />} />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <ErrorBoundary>
                  <ClientDashboard />
                </ErrorBoundary>
              </Protected>
            }
          />
          <Route
            path="/client/dashboard"
            element={
              <CustomerOnly>
                <ErrorBoundary>
                  <ClientDashboard />
                </ErrorBoundary>
              </CustomerOnly>
            }
          />
          <Route
            path="/passport/forms/edit/:section"
            element={
              <CustomerOnly>
                <ErrorBoundary>
                  <ClientDashboard />
                </ErrorBoundary>
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
          <Route
            path="/messages"
            element={
              <Protected>
                <MessagesRedirect />
              </Protected>
            }
          />
          <Route
            path="/messages/:conversationId"
            element={
              <Protected>
                <MessagesRedirect />
              </Protected>
            }
          />
          <Route path="/agent/onboarding" element={<AgentOnboarding />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/data-sharing" element={<DataSharing />} />
          <Route path="/agent-responsibilities" element={<AgentResponsibilities />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/legal-notice" element={<LegalNotice />} />
          <Route path="/share/:token" element={<ShareProfile />} />
          <Route path="/recover" element={<AccountRecovery />} />
          <Route path="/account-deleted" element={<AccountDeleted />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/errors" element={<Admin initialView="errors" />} />
        </Routes>
      </div>
      {footerHiddenOnMobile ? (
        <div className="hidden lg:block">
          <Footer />
        </div>
      ) : (
        <Footer />
      )}
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
