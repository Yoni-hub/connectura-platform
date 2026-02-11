import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'
import { ProfileProvider } from './context/ProfileContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { initErrorReporting, reportError } from './utils/errorReporting'

export default function App() {
  useEffect(() => {
    initErrorReporting()
  }, [])

  return (
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
      <AuthProvider>
        <AgentProvider>
          <ProfileProvider>
            <AppRouter />
            <Toaster position="top-right" />
          </ProfileProvider>
        </AgentProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
