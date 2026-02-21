import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Home from '../pages/Home'
import ClientDashboard from '../pages/ClientDashboard'
import Contact from '../pages/Contact'
import About from '../pages/About'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import LegalNotice from '../pages/LegalNotice'
import Terms from '../pages/Terms'
import Privacy from '../pages/Privacy'
import DataSharing from '../pages/DataSharing'
import Admin from '../pages/Admin'
import ShareProfile from '../pages/ShareProfile'
import PassportHome from '../pages/PassportHome'
import PassportProductEditor from '../pages/PassportProductEditor'
import AccountRecovery from '../pages/AccountRecovery'
import AccountDeleted from '../pages/AccountDeleted'
import NotFound from '../pages/NotFound'
import DevTypography from '../pages/dev/DevTypography'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/navbar/Navbar'
import Footer from '../components/footer/Footer'
import LegalConsentModal from '../components/modals/LegalConsentModal'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { reportError } from '../utils/errorReporting'

function Protected({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

function CustomerOnly({ children }) {
  const { user, authReady } = useAuth()
  if (!authReady) return null
  if (!user) return <Navigate to="/" replace />
  if (user.role !== 'CUSTOMER') return <Navigate to="/dashboard" replace />
  return children
}

function Layout() {
  const location = useLocation()
  const footerHiddenOnMobile =
    location.pathname === '/client/dashboard' ||
    location.pathname === '/dashboard'

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <LegalConsentModal />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile/create" element={<Navigate to="/client/dashboard?tab=my%20passport" replace />} />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <ErrorBoundary
                  onError={(error, info) =>
                    reportError({
                      source: 'react',
                      message: error?.message || 'React render error',
                      stack: error?.stack,
                      componentStack: info?.componentStack || null,
                    })
                  }
                >
                  <ClientDashboard />
                </ErrorBoundary>
              </Protected>
            }
          />
          <Route
            path="/client/dashboard"
            element={
              <CustomerOnly>
                <ErrorBoundary
                  onError={(error, info) =>
                    reportError({
                      source: 'react',
                      message: error?.message || 'React render error',
                      stack: error?.stack,
                      componentStack: info?.componentStack || null,
                    })
                  }
                >
                  <ClientDashboard />
                </ErrorBoundary>
              </CustomerOnly>
            }
          />
          <Route
            path="/passport/forms/edit/:section"
            element={
              <CustomerOnly>
                <Navigate to="/client/dashboard?tab=my%20passport" replace />
              </CustomerOnly>
            }
          />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/data-sharing" element={<DataSharing />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/legal-notice" element={<LegalNotice />} />
          <Route path="/share/:token" element={<ShareProfile />} />
          <Route
            path="/passport"
            element={
              <CustomerOnly>
                <PassportHome />
              </CustomerOnly>
            }
          />
          <Route
            path="/passport/products/:productInstanceId"
            element={
              <CustomerOnly>
                <PassportProductEditor />
              </CustomerOnly>
            }
          />
          <Route path="/recover" element={<AccountRecovery />} />
          <Route path="/account-deleted" element={<AccountDeleted />} />
          {import.meta.env.DEV && <Route path="/dev/typography" element={<DevTypography />} />}
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/errors" element={<Admin initialView="errors" />} />
          <Route path="*" element={<NotFound />} />
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
