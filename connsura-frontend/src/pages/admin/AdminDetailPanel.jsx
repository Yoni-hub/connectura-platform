import React from 'react'

export default function AdminDetailPanel({ tab, closeTab, saveAgentTab, saveClientTab, patchTabForm }) {
  if (!tab) return null
  if (tab.loading) return <div className="text-slate-600">Loading details...</div>
  if (!tab.form) return <div className="text-slate-500">No details loaded.</div>
  const input = 'mt-1 w-1/5 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const textarea = `${input} min-h-[100px]`
  const sectionCard = 'rounded-xl border border-slate-200 bg-slate-50 p-3'
  const sectionTitle = 'text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500'
  if (tab.type === 'agent') {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-600">
            Agent #{tab.id} - editable onboarding and sign-up details (password shown hashed)
          </div>
          <div className="flex gap-2">
            <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
              Close tab
            </button>
            <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveAgentTab(tab)} disabled={tab.saving}>
              {tab.saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className={sectionCard}>
            <div className={sectionTitle}>Account credentials</div>
            <div className="mt-2 space-y-2.5">
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
              <label className="block text-[13px] font-semibold text-slate-700">
                Status
                <select
                  className={input}
                  value={tab.form.status}
                  onChange={(e) => patchTabForm(tab.key, { status: e.target.value })}
                >
                  {['pending', 'approved', 'rejected', 'suspended'].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.underReview}
                    onChange={(e) => patchTabForm(tab.key, { underReview: e.target.checked })}
                  />
                  Under review
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.isSuspended}
                    onChange={(e) => patchTabForm(tab.key, { isSuspended: e.target.checked })}
                  />
                  Suspended
                </label>
              </div>
              <label className="block text-[13px] font-semibold text-slate-700">
                Rating
                <input
                  className={input}
                  value={tab.form.rating}
                  type="number"
                  step="0.1"
                  onChange={(e) => patchTabForm(tab.key, { rating: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className={sectionCard}>
            <div className={sectionTitle}>Identity & licensing</div>
            <div className="mt-2 space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Phone
                <input className={input} value={tab.form.phone} onChange={(e) => patchTabForm(tab.key, { phone: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Availability
                <select
                  className={input}
                  value={tab.form.availability}
                  onChange={(e) => patchTabForm(tab.key, { availability: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Address
                <input
                  className={input}
                  value={tab.form.address}
                  onChange={(e) => patchTabForm(tab.key, { address: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                ZIP
                <input className={input} value={tab.form.zip} onChange={(e) => patchTabForm(tab.key, { zip: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Producer/license number
                <input
                  className={input}
                  value={tab.form.producerNumber}
                  onChange={(e) => patchTabForm(tab.key, { producerNumber: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className={sectionCard}>
            <div className={sectionTitle}>Products & audiences</div>
            <div className="mt-2 space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Specialty
                <input
                  className={input}
                  value={tab.form.specialty}
                  onChange={(e) => patchTabForm(tab.key, { specialty: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Languages (comma-separated)
                <input
                  className={input}
                  value={tab.form.languages}
                  onChange={(e) => patchTabForm(tab.key, { languages: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                States (comma-separated)
                <input className={input} value={tab.form.states} onChange={(e) => patchTabForm(tab.key, { states: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Products (comma-separated)
                <input
                  className={input}
                  value={tab.form.products}
                  onChange={(e) => patchTabForm(tab.key, { products: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Appointed carriers (comma-separated)
                <input
                  className={input}
                  value={tab.form.appointedCarriers}
                  onChange={(e) => patchTabForm(tab.key, { appointedCarriers: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Bio
                <textarea
                  className={textarea}
                  value={tab.form.bio}
                  onChange={(e) => patchTabForm(tab.key, { bio: e.target.value })}
                  placeholder="Short bio used in onboarding"
                />
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
            Close tab
          </button>
          <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveAgentTab(tab)} disabled={tab.saving}>
            {tab.saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    )
  }
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
