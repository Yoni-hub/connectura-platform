import { getPasswordPolicyChecks } from '../../utils/passwordPolicy'

export default function PasswordRequirements({ password = '', className = '' }) {
  const checks = getPasswordPolicyChecks(password)

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <div className="text-sm font-semibold text-slate-700">Password requirements</div>
      <div className="mt-2 space-y-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-2 text-sm">
            <span className={check.met ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>
              {check.met ? '✓' : '✕'}
            </span>
            <span className={check.met ? 'text-emerald-700' : 'text-slate-600'}>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
