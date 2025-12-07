import { useEffect, useState } from 'react'
import { languages } from '../../data/languages'
import { states } from '../../data/states'

export default function SearchBar({ onSearch, busy }) {
  const [filters, setFilters] = useState({ state: '', language: '', name: '' })

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <div className="flex items-end">
          <button
            onClick={() => onSearch(filters)}
            disabled={busy}
            className="w-full rounded-xl bg-[#7a0638] px-4 py-3 text-white font-semibold shadow hover:bg-[#5f042c] disabled:opacity-60"
          >
            {busy ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>
    </div>
  )
}
