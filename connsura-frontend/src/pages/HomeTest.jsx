import { Link } from 'react-router-dom'

export default function HomeTest() {
  return (
    <main className="bg-white text-slate-900">
      <section
        className="relative overflow-hidden px-4 pb-12 pt-10 sm:px-8 lg:px-16"
        aria-labelledby="home-test-hero"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-profile-lines"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#006aff]/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600">
              Connsura - Insurance Passport
            </p>
            <h1
              id="home-test-hero"
              className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Create your insurance profile once. Share it with any agent.
            </h1>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">
              Stop repeating forms. Connsura keeps your details ready so agents can quote you faster.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600 shadow-sm">
                <span className="font-semibold text-slate-900">One profile</span>
                <span className="mt-1 block">Reuse it for auto, home, life, and more.</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600 shadow-sm">
                <span className="font-semibold text-slate-900">Share anywhere</span>
                <span className="mt-1 block">Send your profile to any agent in seconds.</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600 shadow-sm">
                <span className="font-semibold text-slate-900">Faster quotes</span>
                <span className="mt-1 block">Agents work from the same up-to-date info.</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="pill-btn-primary px-6 py-3 text-sm sm:text-base" to="/profile/create">
                Create Your Profile
              </Link>
              <Link className="pill-btn-ghost px-6 py-3 text-sm sm:text-base" to="/agents">
                I am an agent
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              We do not sell insurance. Independent agents handle quotes and policies.
            </p>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Profile snapshot
                </span>
                <span className="rounded-full bg-[#006aff]/10 px-3 py-1 text-xs font-semibold text-[#006aff]">
                  Ready to share
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <p className="text-xs text-slate-500">Coverage</p>
                  <p className="font-semibold text-slate-900">Auto + Home + Life</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="text-xs text-slate-500">Household</p>
                    <p className="font-semibold text-slate-900">2 drivers</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <p className="text-xs text-slate-500">Property</p>
                    <p className="font-semibold text-slate-900">Primary home</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-xs text-slate-500">Share link</p>
                  <p className="font-mono text-xs text-slate-700">connsura.com/share/8f3gk2</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <p className="text-xs text-slate-500">Agent requests</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      Spanish speaking
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      Florida
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      Home bundle
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="pill-btn-primary px-5 py-2 text-sm">
                  Share with agent
                </button>
                <button type="button" className="pill-btn-ghost px-5 py-2 text-sm">
                  Preview profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="home-test-steps">
        <div className="space-y-6">
          <h2 id="home-test-steps" className="text-2xl font-semibold text-slate-900">
            How it works
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: 'Create your profile',
                body: 'Answer questions once, at your pace.',
              },
              {
                title: 'Share with agents',
                body: 'Send your profile link to any agent.',
              },
              {
                title: 'Get faster quotes',
                body: 'Agents quote from the same updated info.',
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#006aff] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-8 lg:px-16" aria-labelledby="home-test-why">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="space-y-4">
              <h2 id="home-test-why" className="text-2xl font-semibold text-slate-900">
                Built for clarity and control
              </h2>
              <p className="text-sm text-slate-600">
                You decide which agents see your information. Update once, and every share stays current.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link className="pill-btn-primary px-6 py-3 text-sm" to="/profile/create">
                  Start your profile
                </Link>
                <Link className="pill-btn-ghost px-6 py-3 text-sm" to="/agents">
                  Find an agent
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: 'No resubmitting',
                  body: 'Reuse your profile across multiple quotes.',
                },
                {
                  title: 'Always updated',
                  body: 'Edit once and share the latest version.',
                },
                {
                  title: 'Agent friendly',
                  body: 'Profiles are easy for agents to read.',
                },
                {
                  title: 'Your data',
                  body: 'You control who can access it.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
