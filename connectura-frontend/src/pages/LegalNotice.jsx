export default function LegalNotice() {
  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Legal notice</h1>
        <p className="text-slate-600">Regulatory and licensing information.</p>
      </div>

      <div className="surface p-6 space-y-4">
        <p className="text-slate-700">
          Connectura provides a matchmaking platform between consumers and licensed insurance agents. We are not a carrier
          and do not bind coverage. Quotes are provided by agents and subject to carrier underwriting.
        </p>
        <p className="text-slate-700">
          For licensing or compliance questions, contact legal@connectura.test. State-specific producer details are
          available upon request.
        </p>
      </div>
    </main>
  )
}
