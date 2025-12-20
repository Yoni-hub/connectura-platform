export default function Badge({ label, tone = 'gray' }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
    gray: 'bg-slate-100 text-slate-700',
  }
  return <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${tones[tone]}`}>{label}</span>
}
