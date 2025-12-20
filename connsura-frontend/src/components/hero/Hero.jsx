import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <div className="relative w-full overflow-hidden bg-[#0b2a6f] text-white min-h-[70vh]">
      <div className="absolute inset-0">
        <img
          src="/hero-insurance.png"
          alt="Family protected by umbrella"
          className="h-full w-full object-cover"
          style={{ objectPosition: '50% 40%' }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2a6f]/90 via-[#0b2a6f]/70 to-[#0b2a6f]/35" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 px-5 py-12 text-white sm:px-10 lg:px-16 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-100">Connsura</p>
        <h1 className="max-w-5xl text-3xl font-bold leading-tight md:text-5xl text-white drop-shadow-lg">
          Find a trusted insurance agent wherever you live.
        </h1>
        <p className="max-w-3xl text-lg text-white/90 drop-shadow">
          Speak to licensed agents who understand your language, answer quickly, and help you save on coverage. Chat, call, or hop on video in one place.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link className="pill-btn-primary px-12 py-3.5 text-base" to="/agents">
            Start your search
          </Link>
          <button
            type="button"
            className="pill-btn-ghost px-12 py-3.5 text-base bg-white text-[#0b3b8c]"
            onClick={() => window.dispatchEvent(new CustomEvent('open-customer-auth'))}
          >
            Create profile
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-100">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-white/15 text-base font-semibold">
            24/7
          </div>
          <span>Live agent requests, saved profiles, and secure calls from any device.</span>
        </div>
      </div>
    </div>
  )
}
