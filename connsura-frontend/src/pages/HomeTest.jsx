import { Link } from 'react-router-dom'

export default function HomeTest() {
  return (
    <main className="bg-white text-slate-900">
      <section className="px-3 pb-12 pt-9 sm:px-6 lg:px-12" aria-labelledby="home-test-hero">
        <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Solution for Clients
            </p>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Organize your personal and business information in one place.</p>
              <p>Share it whenever you need coverage.</p>
              <p>Keep everything ready for insurance decisions.</p>
            </div>
          </div>
          <div className="space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Connsura
            </p>
            <h1 id="home-test-hero" className="text-3xl font-semibold leading-tight sm:text-4xl">
              Your insurance passport
            </h1>
            <div className="flex flex-wrap justify-center gap-3">
              <Link className="pill-btn-primary px-6 py-3 text-sm sm:text-base" to="/profile/create">
                Build your profile for free
              </Link>
              <Link className="pill-btn-ghost px-6 py-3 text-sm sm:text-base" to="/agents">
                Talk to an agent
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              We do not sell insurance. Independent agents handle quotes and policies.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Solution for Agents
            </p>
            <p className="text-sm text-slate-600">
              Find the complete, correct information you need to give your clients the most accurate coverage.
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}
