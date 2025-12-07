import { Toaster } from 'react-hot-toast'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'
import { ProfileProvider } from './context/ProfileContext'

export default function App() {
  return (
    <AuthProvider>
      <AgentProvider>
        <ProfileProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </ProfileProvider>
      </AgentProvider>
    </AuthProvider>
  )
}
