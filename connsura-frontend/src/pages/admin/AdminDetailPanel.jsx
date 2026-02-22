import React from 'react'

export default function AdminDetailPanel({ tab, closeTab, saveClientTab, patchTabForm }) {
  if (!tab) return null
  if (tab.loading) return <div className="text-slate-600">Loading details...</div>
  if (!tab.form) return <div className="text-slate-500">No details loaded.</div>
  const input = 'mt-1 w-1/5 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm'
  if (tab.type === 'client') {
    const passportProducts = Array.isArray(tab.data?.passportSummary?.products) ? tab.data.passportSummary.products : []
    const passportStats = tab.data?.passportSummary?.stats || {}
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-600">Client #{tab.id} account controls and passport summary</div>
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
            <label className="block text-sm font-semibold text-slate-700">
              Name
              <input className={input} value={tab.form.name} onChange={(e) => patchTabForm(tab.key, { name: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                className={input}
                value={tab.form.email}
                onChange={(e) => patchTabForm(tab.key, { email: e.target.value })}
                type="email"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              New password (leave blank to keep current)
              <input
                className={input}
                value={tab.form.password}
                onChange={(e) => patchTabForm(tab.key, { password: e.target.value })}
                type="password"
              />
            </label>
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!tab.form.isDisabled}
                  onChange={(e) => patchTabForm(tab.key, { isDisabled: e.target.checked })}
                />
                Disabled
              </label>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-700">Passport data</div>
              <div className="mt-2 text-sm text-slate-600">
                Products: {Number(passportStats.activeProducts || 0)} | Sections saved:{' '}
                {Number(passportStats.sectionResponseCount || 0)} | Custom questions:{' '}
                {Number(passportStats.customQuestionCount || 0)}
              </div>
              {passportProducts.length === 0 && (
                <div className="mt-2 text-sm text-slate-500">No active passport products.</div>
              )}
              {passportProducts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passportProducts.map((product) => (
                    <div key={product.id} className="text-sm text-slate-700">
                      {product.productName} ({product.productSource}) - sections {product.sectionResponseCount}, custom questions{' '}
                      {product.customQuestionCount}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

