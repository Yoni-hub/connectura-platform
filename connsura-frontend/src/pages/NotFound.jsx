export default function NotFound() {
  return (
    <main className="page-shell py-12">
      <div className="surface p-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">404</p>
        <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-600">
          The page you are looking for does not exist. Return to the homepage to continue.
        </p>
      </div>
    </main>
  )
}
