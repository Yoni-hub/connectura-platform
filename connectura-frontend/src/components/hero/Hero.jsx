import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#f5f1ed] border border-slate-200 shadow-sm p-10 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(122,6,56,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.05),transparent_30%)]" />
      <div className="relative max-w-4xl mx-auto text-center space-y-4">
        <p className="text-sm font-semibold text-[#7a0638] uppercase tracking-wide">Connectura</p>
        <h1 className="text-3xl md:text-4xl font-bold leading-snug">
          Need an insurance agent who speaks your language? We&apos;ll find the right match near you. Start chatting, calling, or video-calling a licensed professional today.
        </h1>
        <p className="text-slate-700 text-lg">
          Insurance paperwork overwhelming? Let a licensed agent create your profile for you. Save it once and reuse it forever.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link className="pill-btn-primary px-12 py-3.5 text-base" to="/agents">
            Find an agent
          </Link>
          <button
            type="button"
            className="pill-btn-ghost px-12 py-3.5 text-base"
            onClick={() => window.dispatchEvent(new CustomEvent('open-customer-auth'))}
          >
            Create Insurance Profile
          </button>
        </div>
      </div>
    </div>
  )
}
