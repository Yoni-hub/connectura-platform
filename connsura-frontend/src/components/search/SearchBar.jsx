import { useState } from 'react'
import { languages } from '../../data/languages'
import { states } from '../../data/states'

export default function SearchBar({ onSearch, onFilterChange, busy, variant = 'card', requireFilters = false }) {
  const [filters, setFilters] = useState({ location: '', state: '', language: '', name: '' })
  const hasFilters = (value) => Object.values(value).some((entry) => String(entry || '').trim())

  const update = (key, value) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    onFilterChange?.(next)
    if (requireFilters && !hasFilters(next)) return
    onSearch(next)
  }

  const wrapperClass =
    variant === 'minimal'
      ? 'w-full bg-transparent p-0'
      : 'glass rounded-[28px] border-[#dfe7f3] bg-white/95 p-6 shadow-[0_26px_70px_rgba(0,42,92,0.08)]'

  return (
    <div className={wrapperClass}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Near</label>
          <div className="relative">
            <input
              className="w-full rounded-2xl border border-[#cfd9eb] bg-white px-4 py-3 pr-12 text-[15px] shadow-[0_10px_24px_rgba(0,42,92,0.06)] placeholder:text-slate-400 focus:border-[#006aff] focus:ring-[#006aff]/25"
              placeholder="Search by address, city, or ZIP"
              value={filters.location}
              onChange={(e) => update('location', e.target.value)}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="m15.5 15.5 3.5 3.5" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">State</label>
          <select
            className="w-full rounded-2xl border border-[#cfd9eb] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(0,42,92,0.06)] focus:border-[#006aff] focus:ring-[#006aff]/25"
            value={filters.state}
            onChange={(e) => update('state', e.target.value)}
          >
            <option value="">Any</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Language</label>
          <select
            className="w-full rounded-2xl border border-[#cfd9eb] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(0,42,92,0.06)] focus:border-[#006aff] focus:ring-[#006aff]/25"
            value={filters.language}
            onChange={(e) => update('language', e.target.value)}
          >
            <option value="">Any</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Name</label>
          <input
            className="w-full rounded-2xl border border-[#cfd9eb] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(0,42,92,0.06)] focus:border-[#006aff] focus:ring-[#006aff]/25"
            placeholder="Search by name"
            value={filters.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div className="flex items-end justify-center md:col-span-2 lg:col-span-5">
          <button
            onClick={() => {
              if (requireFilters && !hasFilters(filters)) return
              onSearch(filters)
            }}
            disabled={busy}
            className="pill-btn-primary w-full px-12 py-3.5 text-base md:w-auto disabled:opacity-60"
          >
            {busy ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>
    </div>
  )
}
