import Hero from '../components/hero/Hero'
import SearchBar from '../components/search/SearchBar'
import Badge from '../components/ui/Badge'
import { useAgents } from '../context/AgentContext'
import { Link } from 'react-router-dom'

export default function Home() {
  const { agents, loading, fetchAgents } = useAgents()

  return (
    <main className="space-y-0 bg-white">
      <Hero />

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

      <section className="relative overflow-hidden px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-overview">
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-3d"
          aria-hidden="true"
        />
        <div className="relative z-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/40 bg-white/45 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <h2 id="home-overview" className="text-2xl font-semibold">
              Insurance shopping is frustrating.
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {[
                'Same questions again and again.',
                'Confusing insurance language.',
                'Every agent needs the same info.',
                'One change means starting over.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#006aff]">
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
          <div className="rounded-2xl border border-white/40 bg-white/45 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <h2 className="text-2xl font-semibold">Your Insurance Profile, Always Ready</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {[
                'Build once, reuse anytime.',
                'Update as life changes.',
                'Share instantly with agents.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#006aff]">
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

      <section className="relative overflow-hidden px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-trust">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/4 z-0 h-1/2 bg-3d"
          aria-hidden="true"
        />
        <div className="relative z-10 grid gap-6 lg:grid-cols-2 lg:items-center">
          <div className="flex items-center justify-center lg:justify-start">
            <img
              src="/hero-insurance-right.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full max-h-[320px] object-contain sm:max-h-[420px]"
              loading="lazy"
            />
          </div>
          <div className="space-y-4 lg:pl-10 xl:pl-16">
            <div className="-mt-4 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <h2 id="home-trust" className="text-2xl font-semibold">
                We don't sell insurance.
              </h2>
              <p className="text-sm text-slate-600">We help you create and share your insurance profile.</p>
              <p className="text-sm text-slate-600">Quotes and policies are handled by independent agents.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="pill-btn-primary px-6 py-3" to="/profile/create">
                Create Your Insurance Profile
              </Link>
              <Link className="pill-btn-ghost px-6 py-3" to="/agents">
                Find an Agent Who Speaks Your Language
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
