import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <section className="px-4 pt-8 sm:px-8 lg:px-16">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="p-6">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Connsura - Your Insurance Passport
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              Create Your Insurance Profile - Once
            </h1>
            <p className="text-sm text-slate-600">
              Create your insurance profile once. Share it anywhere. Get insurance help faster.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link className="pill-btn-primary px-6 py-3 text-sm sm:text-base" to="/profile/create">
                Create Your Insurance Profile
              </Link>
              <button
                type="button"
                className="pill-btn-ghost px-6 py-3 text-sm sm:text-base"
                onClick={() => {
                  window.location.href = '/agents'
                }}
              >
                Talk to an Agent
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                24/7
              </div>
              <span>Skip repetitive forms. Save time. Get help in your language when you need it.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <img
            src="/hero-insurance-right.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full max-h-[320px] object-contain sm:max-h-[360px]"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
