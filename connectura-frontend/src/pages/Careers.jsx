const roles = [
  { title: 'Senior Fullstack Engineer', location: 'Remote', type: 'Full time' },
  { title: 'Customer Success Lead', location: 'Austin, TX', type: 'Full time' },
  { title: 'Bilingual Support Specialist', location: 'Remote', type: 'Contract' },
]

export default function Careers() {
  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Careers</h1>
        <p className="text-slate-600">Join us in connecting customers with licensed agents who speak their language.</p>
      </div>

      <div className="surface p-6 space-y-4">
        <h2 className="text-xl font-semibold">Open roles</h2>
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.title} className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{role.title}</div>
                  <div className="text-sm text-slate-600">
                    {role.location} · {role.type}
                  </div>
                </div>
                <button className="pill-btn-primary text-sm">Apply</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
