import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0b3b8c] px-4 pt-8 sm:px-8 lg:px-16">
      <div className="relative z-10 grid gap-6">
        <div className="p-6">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              Connsura - Your Insurance Passport
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Create Your Insurance Profile - Once
            </h1>
            <p className="text-sm text-white/90">
              Build a reusable insurance profile you control. Fill it out yourself, or invite an agent to help complete
              and update it for you&mdash;securely, with permission.
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-1">
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
