export default function PrivacyPolicy() {
  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Privacy policy</h1>
        <p className="text-slate-600">How we handle your data.</p>
      </div>

      <div className="surface p-6 space-y-4">
        <p className="text-slate-700">
          We collect the information you share to match you with licensed agents. Data is stored securely and never sold.
          You can request deletion of your data at any time by contacting support@connectura.test.
        </p>
        <p className="text-slate-700">
          We use cookies to keep you signed in and to remember your preferences. Calls and profiles are processed through
          our API; only licensed agents you choose can access shared profiles.
        </p>
      </div>
    </main>
  )
}
