import Hero from '../components/hero/Hero'
import SearchBar from '../components/search/SearchBar'
import Badge from '../components/ui/Badge'
import { useAgents } from '../context/AgentContext'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { agents, loading, fetchAgents } = useAgents()
  const { user } = useAuth()
  const nav = useNavigate()

  const handleCreateProfile = () => {
    if (user?.role === 'CUSTOMER') {
      nav('/client/dashboard?tab=forms')
      return
    }
    if (user?.role === 'AGENT') {
      nav('/agent/dashboard')
      return
    }
    sessionStorage.setItem('connsura_post_auth_redirect', '/client/dashboard?tab=forms')
    window.dispatchEvent(new Event('open-customer-auth-signup'))
  }

  return (
    <main className="space-y-0 bg-white">
      <Hero onCreateProfile={handleCreateProfile} />

      <section className="px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-how-it-works">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <h2 id="home-how-it-works" className="text-2xl font-semibold">
              How It Works
            </h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Create Your Profile',
                body: 'Enter your information once, at your own pace.',
                image: '/how-1.png',
                alt: 'Profile setup illustration',
              },
              {
                title: 'Get Help',
                body: 'Connect with agents who speak your language.',
                image: '/how-2.png',
                alt: 'Agent support illustration',
              },
              {
                title: 'Share Instantly',
                body: 'Send your saved profile to any agent.',
                image: '/how-3.png',
                alt: 'Secure sharing illustration',
              },
              {
                title: 'Shop Faster',
                body: 'Agents use your profile to quote you on their own systems.',
                image: '/how-4.png',
                alt: 'Quoting faster illustration',
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <img
                  src={step.image}
                  alt={step.alt}
                  className="mb-4 h-24 w-full rounded-xl object-cover"
                  loading="lazy"
                />
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#006aff] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0b3b8c] px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-overview">
        <div className="relative z-10 grid gap-8 text-center lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          <div className="space-y-4 text-white">
            <h2 id="home-overview" className="text-2xl font-semibold text-white">
              Insurance shopping is frustrating.
            </h2>
            <ul className="mx-auto inline-flex flex-col items-start gap-2 text-sm text-white/90 text-left">
              {[
                'Same questions again and again.',
                'Confusing insurance language.',
                'Every agent needs the same info.',
                'One change means starting over.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-white">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M7.5 13.5 3.5 9.6l1.4-1.4 2.6 2.6 7.1-7.1 1.4 1.4-8.5 8.4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden h-full w-px bg-white/30 lg:block" aria-hidden="true" />
          <div className="space-y-4 text-white">
            <h2 className="text-2xl font-semibold text-white">Your Insurance Profile, Always Ready</h2>
            <ul className="mx-auto inline-flex flex-col items-start gap-2 text-sm text-white/90 text-left">
              {[
                'Build once, reuse anytime.',
                'Update as life changes.',
                'Share instantly with agents.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-white">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M7.5 13.5 3.5 9.6l1.4-1.4 2.6 2.6 7.1-7.1 1.4 1.4-8.5 8.4Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4 px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="search-agents">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div id="search-agents">
            <h2 className="text-2xl font-semibold">Search agents</h2>
            <p className="text-sm text-slate-600">Filter by state, language, or name to start a conversation.</p>
          </div>
          <Badge label="Live filters" tone="blue" />
        </div>
        <SearchBar busy={loading} onSearch={fetchAgents} agents={agents} variant="minimal" />
      </section>

      <section className="relative overflow-hidden bg-[#0b3b8c] px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-trust">
        <div className="relative z-10 flex justify-center">
          <div className="max-w-2xl space-y-4 text-center text-white">
            <div className="space-y-2">
              <h2 id="home-trust" className="text-2xl font-semibold text-white">
                We don't sell insurance.
              </h2>
              <p className="text-sm text-white/90">We help you create and share your insurance profile.</p>
              <p className="text-sm text-white/90">Quotes and policies are handled by independent agents.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button type="button" className="pill-btn-primary px-6 py-3" onClick={handleCreateProfile}>
                Create Your Insurance Profile
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
