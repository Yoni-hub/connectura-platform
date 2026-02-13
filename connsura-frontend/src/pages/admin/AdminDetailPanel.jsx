import React from 'react'

export default function AdminDetailPanel({ tab, closeTab, saveClientTab, patchTabForm }) {
  if (!tab) return null
  if (tab.loading) return <div className="text-slate-600">Loading details...</div>
  if (!tab.form) return <div className="text-slate-500">No details loaded.</div>
  const input = 'mt-1 w-1/5 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const textarea = `${input} min-h-[100px]`
  if (tab.type === 'client') {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-600">Client #{tab.id} - full profile and sign-up details</div>
          <div className="flex gap-2">
            <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
              Close tab
            </button>
            <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveClientTab(tab)} disabled={tab.saving}>
              {tab.saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2.5">
            <label className="block text-[13px] font-semibold text-slate-700">
              Name
              <input className={input} value={tab.form.name} onChange={(e) => patchTabForm(tab.key, { name: e.target.value })} />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Email
              <input
                className={input}
                value={tab.form.email}
                onChange={(e) => patchTabForm(tab.key, { email: e.target.value })}
                type="email"
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Password (hashed)
              <input
                className={input}
                value={tab.form.password}
                onChange={(e) => patchTabForm(tab.key, { password: e.target.value })}
                type="text"
              />
            </label>
            <div className="flex items-center gap-3 text-[13px] font-semibold text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!tab.form.isDisabled}
                  onChange={(e) => patchTabForm(tab.key, { isDisabled: e.target.checked })}
                />
                Disabled
              </label>
            </div>
          </div>
          <div className="space-y-2.5">
            <label className="block text-[13px] font-semibold text-slate-700">
              Preferred languages (comma-separated)
              <input
                className={input}
                value={tab.form.preferredLangs}
                onChange={(e) => patchTabForm(tab.key, { preferredLangs: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Coverages (comma-separated)
              <input
                className={input}
                value={tab.form.coverages}
                onChange={(e) => patchTabForm(tab.key, { coverages: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Prior insurance (comma-separated)
              <input
                className={input}
                value={tab.form.priorInsurance}
                onChange={(e) => patchTabForm(tab.key, { priorInsurance: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Profile data (JSON)
              <textarea
                className={textarea}
                value={tab.form.profileData}
                onChange={(e) => patchTabForm(tab.key, { profileData: e.target.value })}
                spellCheck={false}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
            Close tab
          </button>
          <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveClientTab(tab)} disabled={tab.saving}>
            {tab.saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    )
  }
  return null
}
