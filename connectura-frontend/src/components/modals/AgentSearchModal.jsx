import { useMemo, useState } from 'react'
import { api } from '../../services/api'

const states = [
  { value: '', label: '---Select State---' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AS', label: 'American Samoa' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'GU', label: 'Guam' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'VI', label: 'U.S. Virgin Islands' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]

const insuranceTypes = [
  { value: '', label: '---Select Insurance Type---' },
  { value: 'AT', label: 'Automobile' },
  { value: 'CM', label: 'Commercial' },
  { value: 'DN', label: 'Dental' },
  { value: 'FL', label: 'Flood' },
  { value: 'HD', label: 'Health \\ Disability' },
  { value: 'HM', label: 'Home' },
  { value: 'LF', label: 'Life' },
  { value: 'LT', label: 'Long-Term Care' },
  { value: 'PT', label: 'Pet' },
  { value: 'SC', label: 'Settlement\\Closing Providers' },
  { value: 'SL', label: 'Surplus Lines' },
  { value: 'TI', label: 'Title' },
  { value: 'TV', label: 'Travel' },
  { value: 'VA', label: 'Variable \\ Annuities' },
]

const licenseTypes = [
  { value: '', label: '---Select License Type---' },
  { value: 'CR', label: 'Credit' },
  { value: 'HE', label: 'Health' },
  { value: 'LA', label: 'Life & Annuities' },
  { value: 'LHC', label: 'Life & Health Consultant' },
  { value: 'LLH', label: 'Limited Life & Health' },
  { value: 'PEI', label: 'Limited Lines P&C - PEI' },
  { value: 'SS', label: 'Limited Lines P&C - SSI' },
  { value: 'TR', label: 'Limited Lines P&C - Travel' },
  { value: 'LPC', label: 'Limited Property & Casualty' },
  { value: 'MGA', label: 'Managing General Agent' },
  { value: 'MVRC', label: 'Motor Vehicle Rental Contract' },
  { value: 'NAV', label: 'Navigator' },
  { value: 'PL', label: 'Personal Lines' },
  { value: 'PBM', label: 'Pharmacy Benefits Manager' },
  { value: 'PC', label: 'Property & Casualty' },
  { value: 'PCC', label: 'Property & Casualty Consultant' },
  { value: 'PAJ', label: 'Public Adjuster' },
  { value: 'RIB', label: 'Reinsur Intermediary Broker' },
  { value: 'RIM', label: 'Reinsur Intermediary Manager' },
  { value: 'RECA', label: 'Settlement Agent' },
  { value: 'SL', label: 'Surplus Lines' },
  { value: 'TLH', label: 'Temporary Life & Health' },
  { value: 'TLHD', label: 'Temporary Life & Health-Debit' },
  { value: 'TPC', label: 'Temporary Property & Casualty' },
  { value: 'TI', label: 'Title' },
  { value: 'VC', label: 'Variable Contracts' },
  { value: 'VS', label: 'Viatical Settlement Broker' },
]

export default function AgentSearchModal({ open, onClose }) {
  const initialForm = useMemo(
    () => ({
      activeOnly: 'active',
      vaLicense: '',
      npn: '',
      lastName: '',
      lastNameMode: 'starts',
      firstName: '',
      city: '',
      state: '',
      zip: '',
      insuranceType: '',
      licenseType: '',
    }),
    []
  )

  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [detail, setDetail] = useState(null)

  const reset = () => setForm(initialForm)

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setResults([])
    setDetail(null)
    try {
      const payload = {
        activeOnly: form.activeOnly === 'active',
        licenseNumber: form.vaLicense,
        npn: form.npn,
        lastName: form.lastName,
        lastNameMode: form.lastNameMode,
        firstName: form.firstName,
        city: form.city,
        state: form.state,
        zip: form.zip,
        insuranceType: form.insuranceType,
        licenseType: form.licenseType,
      }
      const res = await api.post('/agents/scc-search', payload)
      setResults(res.data.results || [])
      setDetail(res.data.detail || null)
      if (!res.data.results?.length) {
        setError('No results found. Adjust your criteria and try again.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const input = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm'
  const select = input

  const renderResults = () => {
    if (loading) return <div className="text-sm text-slate-700">Searching SCC...</div>
    if (error) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">{error}</div>
    if (!results.length && !detail) {
      return (
        <div className="text-sm text-slate-700">
          Enter search criteria to start search. Results from SCC will appear here.
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {results.length > 0 && (
          <div className="overflow-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-[#0b0b6a] text-white">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">City</th>
                  <th className="px-2 py-2 text-left">State</th>
                  <th className="px-2 py-2 text-left">Zip</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => (
                  <tr key={`${row.index}-${idx}`} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-[#0b3b8c]">{row.name}</td>
                    <td className="px-2 py-1">{row.status}</td>
                    <td className="px-2 py-1">{row.city}</td>
                    <td className="px-2 py-1">{row.state}</td>
                    <td className="px-2 py-1">{row.zip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail && (
          <div className="rounded border border-slate-200 bg-white p-3 text-sm">
            <div className="text-base font-semibold text-[#0b3b8c]">{detail.name}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>Status: {detail.status || '--'}</div>
              <div>Residency: {detail.residency || '--'}</div>
              <div>City: {detail.city || '--'}</div>
              <div>State: {detail.state || '--'}</div>
              <div>ZIP: {detail.zip || '--'}</div>
              <div>License #: {detail.licenseNumber || '--'}</div>
              <div>NPN: {detail.npn || '--'}</div>
              <div>Effective: {detail.licenseEffective || '--'}</div>
              <div>Expires: {detail.licenseExpires || '--'}</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-8">
      <div className="w-full max-w-6xl rounded-xl bg-white shadow-2xl border border-slate-200">
        <div className="relative flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-base font-semibold text-[#0b3b8c]">Agent Search</div>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close agent search"
          >
            ×
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="mt-4 grid gap-4 md:grid-cols-[360px,1fr]">
            <form className="space-y-4 border border-slate-200 bg-[#f7f9fc] p-4 rounded-lg max-h-[70vh] overflow-y-auto" onSubmit={handleSubmit}>
              <div className="flex items-center gap-4 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="activeOnly"
                    checked={form.activeOnly === 'active'}
                    onChange={() => handleChange('activeOnly', 'active')}
                  />
                  Active Only
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="activeOnly"
                    checked={form.activeOnly === 'all'}
                    onChange={() => handleChange('activeOnly', 'all')}
                  />
                  All
                </label>
              </div>

              <div className="grid gap-3">
                <label className="text-sm text-slate-900 font-semibold">
                  Virginia License Number
                  <input
                    className={input}
                    placeholder="Virginia License Number"
                    value={form.vaLicense}
                    onChange={(e) => handleChange('vaLicense', e.target.value)}
                  />
                </label>
                <label className="text-sm text-slate-900 font-semibold">
                  National Producer Number (NPN)
                  <input className={input} placeholder="NPN" value={form.npn} onChange={(e) => handleChange('npn', e.target.value)} />
                </label>
                <div>
                  <div className="flex items-center justify-between text-sm text-slate-900 font-semibold">
                    <span>Last Name</span>
                    <div className="flex items-center gap-2 text-xs font-normal text-slate-700">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="lastNameMode"
                          checked={form.lastNameMode === 'starts'}
                          onChange={() => handleChange('lastNameMode', 'starts')}
                        />
                        Starts With
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="lastNameMode"
                          checked={form.lastNameMode === 'contains'}
                          onChange={() => handleChange('lastNameMode', 'contains')}
                        />
                        Contains
                      </label>
                    </div>
                  </div>
                  <input className={input} placeholder="Last Name" value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
                </div>
                <label className="text-sm text-slate-900 font-semibold">
                  First Name
                  <input
                    className={input}
                    placeholder="First Name"
                    value={form.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                  />
                </label>
                <label className="text-sm text-slate-900 font-semibold">
                  City
                  <input className={input} placeholder="City" value={form.city} onChange={(e) => handleChange('city', e.target.value)} />
                </label>
                <label className="text-sm text-slate-900 font-semibold">
                  State
                  <select className={select} value={form.state} onChange={(e) => handleChange('state', e.target.value)}>
                    {states.map((st) => (
                      <option key={st.value || 'blank'} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-900 font-semibold">
                  Zip Code
                  <input className={input} placeholder="Zip Code" value={form.zip} onChange={(e) => handleChange('zip', e.target.value)} />
                </label>
                <label className="text-sm text-slate-900 font-semibold">
                  Type of Insurance
                  <select className={select} value={form.insuranceType} onChange={(e) => handleChange('insuranceType', e.target.value)}>
                    {insuranceTypes.map((opt) => (
                      <option key={opt.value || 'ins-blank'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-center text-xs font-semibold text-slate-700">OR</div>
                <label className="text-sm text-slate-900 font-semibold">
                  License Type
                  <select className={select} value={form.licenseType} onChange={(e) => handleChange('licenseType', e.target.value)}>
                    {licenseTypes.map((opt) => (
                      <option key={opt.value || 'lic-blank'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pb-1">
                <button
                  type="submit"
                  className="rounded bg-[#0b3b8c] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#0a357e]"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-[#0b3b8c] shadow-sm"
                  onClick={reset}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </form>

            <div className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-4">{renderResults()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
