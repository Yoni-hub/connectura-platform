import { useEffect, useState } from 'react'
import { languages } from '../../data/languages'
import { states } from '../../data/states'

export default function SearchBar({ onSearch, busy }) {
  const [filters, setFilters] = useState({ location: '', state: '', language: '', name: '' })

  useEffect(() => {
    onSearch(filters)
  }, [])

  const update = (key, value) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    onSearch(next)
  }

  return (
    <div className="glass rounded-2xl p-5 bg-[#f9f6f3]">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Near</label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 shadow-sm focus:border-[#7a0638] focus:ring-[#7a0638]/30"
              placeholder="Search by Address, City or ZIP Code"
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">State</label>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm focus:border-[#7a0638] focus:ring-[#7a0638]/30"
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Language</label>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm focus:border-[#7a0638] focus:ring-[#7a0638]/30"
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Agent name</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm focus:border-[#7a0638] focus:ring-[#7a0638]/30"
            placeholder="Search by name"
            value={filters.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
        <div className="flex items-end justify-center md:col-span-2 lg:col-span-5">
          <button
            onClick={() => onSearch(filters)}
            disabled={busy}
            className="pill-btn-primary px-12 py-3.5 text-base w-full md:w-auto disabled:opacity-60"
          >
            {busy ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>
    </div>
  )
}
