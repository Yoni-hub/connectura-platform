import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#f5f1ed] border border-slate-200 shadow-sm p-10 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(122,6,56,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.05),transparent_30%)]" />
      <div className="relative max-w-4xl mx-auto text-center space-y-4">
        <p className="text-sm font-semibold text-[#7a0638] uppercase tracking-wide">Connectura</p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
          Need an insurance agent who speaks your language?
          <br />
          We’ll find the right match near you.
          <br />
          Start chatting, calling, or video-calling a licensed pro today.
        </h1>
        <p className="text-slate-700 text-lg">
          Search by language, state, or name. Start a voice/video call and co-create your insurance profile together.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link className="rounded-full bg-[#7a0638] text-white px-6 py-3 font-semibold shadow hover:bg-[#5f042c]" to="/agents">
            Find an agent
          </Link>
          <Link className="rounded-full border border-[#7a0638]/20 px-6 py-3 font-semibold text-[#7a0638] hover:bg-white" to="/profile/create">
            Create Insurance Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
