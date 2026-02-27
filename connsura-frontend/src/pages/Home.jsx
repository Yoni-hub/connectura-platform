import Hero from '../components/hero/Hero'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

const trustBadges = ['No data selling', 'Secure storage', 'No ads']

const pricingItems = [
  'Unlimited share links',
  'Unlimited insurance products & profiles',
  'Read-only & read-edit sharing permissions',
  'PDF export of your information',
  'Share with anyone you want',
  'Access control (disable links anytime)',
  'Secure storage & encryption',
  'Ongoing platform updates & improvements',
]

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M8.8 12.4 6.7 10.3l1-1 1.1 1.1 3.6-3.6 1 1-4.6 4.6Z" fill="#fff" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path d="M7.5 13.5 3.5 9.6l1.4-1.4 2.6 2.6 7.1-7.1 1.4 1.4-8.5 8.4Z" fill="currentColor" />
    </svg>
  )
}

export default function Home() {
  const { user } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    if (user?.role !== 'CUSTOMER') return
    const shouldRedirect = sessionStorage.getItem('connsura_force_dashboard') === 'true'
    if (!shouldRedirect) return
    sessionStorage.removeItem('connsura_force_dashboard')
    nav('/client/dashboard', { replace: true })
  }, [user?.role, nav])

  const handleCreateProfile = () => {
    if (user?.role === 'CUSTOMER') {
      nav('/client/dashboard')
      return
    }
    sessionStorage.setItem('connsura_post_auth_redirect', '/client/dashboard')
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
                title: 'Stay Organized',
                body: 'Keep your details ready for any insurer or quote.',
                image: '/how-2.png',
                alt: 'Organized profile illustration',
              },
              {
                title: 'Share Instantly',
                body: 'Send a secure link or PDF in seconds.',
                image: '/how-3.png',
                alt: 'Secure sharing illustration',
              },
              {
                title: 'Move Faster',
                body: 'Reuse your profile wherever you need coverage.',
                image: '/how-4.png',
                alt: 'Faster coverage illustration',
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
                'Every form asks the same info.',
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
                'Share instantly when requested.',
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

      <section className="px-4 py-12 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <h2 className="text-2xl font-semibold text-[#1a2f59]">Simple, honest pricing.</h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
            <div className="space-y-6 text-center text-[#153162] lg:text-left">
              <h3 className="text-2xl font-semibold leading-tight sm:text-3xl">
                One plan. Full access. <span className="font-normal">No surprises.</span>
              </h3>
              <div className="space-y-3 text-sm leading-[1.65] text-[#32507f]">
                <p>
                  Your subscription is what keeps Connsura running, secure, and independent - without ads, data
                  brokers, or hidden monetization.
                </p>
                <p>You stay in control of who sees your information.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                {trustBadges.map((badge) => (
                  <div
                    key={badge}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cfe1ff] bg-[#edf4ff] px-4 py-2 text-sm font-medium text-[#1659c9]"
                  >
                    <span className="text-[#0f62e8]">
                      <CheckCircleIcon />
                    </span>
                    <span>{badge}</span>
                  </div>
                ))}
              </div>

              <fieldset className="rounded-xl border border-slate-300 px-4 pb-4 pt-2">
                <legend className="px-2 text-lg font-semibold text-slate-900">1 Month Free</legend>
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {['Try Connsura free for 30 days.', 'No card information needed.', 'All benefits included.'].map(
                    (item) => (
                      <li key={item} className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-[#32507f]">
                        <span className="text-[#0d66f2]">
                          <CheckIcon />
                        </span>
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
                <button
                  type="button"
                  className="pill-btn-primary mt-4 w-full rounded-xl py-3.5 text-base sm:w-auto sm:px-6"
                  onClick={handleCreateProfile}
                >
                  Try for free
                </button>
              </fieldset>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-[#dce5f2] bg-[#fbfdff] p-6 shadow-[0_16px_35px_rgba(16,47,95,0.2)]">
              <div className="border-b border-[#e2e8f3] pb-4">
                <span className="text-5xl font-semibold text-[#152f5f]">$2</span>
                <span className="ml-1 text-2xl text-[#203a66]">/month</span>
              </div>
              <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 text-left sm:grid-cols-2">
                {pricingItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#2a446f]">
                    <span className="mt-1 text-[#0d66f2]">
                      <CheckIcon />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="pill-btn-primary mt-auto w-full rounded-xl py-3.5 text-base"
                onClick={handleCreateProfile}
              >
                Get full access for $2/month
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0b3b8c] px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-trust">
        <div className="relative z-10 flex justify-center">
          <div className="max-w-2xl space-y-4 text-center text-white">
            <div className="space-y-2">
              <h2 id="home-trust" className="text-2xl font-semibold text-white">
                We don't sell insurance.
              </h2>
              <p className="text-sm text-white/90">We help you create and share your insurance profile.</p>
              <p className="text-sm text-white/90">Use your profile anywhere you need coverage.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
