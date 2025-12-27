import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-8 sm:px-8 lg:px-16">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-3d scale-105"
        aria-hidden="true"
      />
      <div className="relative z-10 grid gap-6">
        <div className="p-6">
          <div className="flex w-full max-w-xl flex-col gap-4 text-black">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/80">
              Connsura - Your Insurance Passport
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-black sm:text-3xl">
              Create Your Insurance Profile - Once
            </h1>
            <p className="text-sm text-black">
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

          </div>
        </div>
      </div>
    </section>
  )
}
