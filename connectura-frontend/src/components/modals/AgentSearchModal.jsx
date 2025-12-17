import { useMemo, useState } from 'react'

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

  const reset = () => setForm(initialForm)

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  if (!open) return null

  const input = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm'
  const select = input

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-8">
      <div className="w-full max-w-5xl rounded-md bg-[#f5f5f8] shadow-2xl border border-slate-200">
        <div className="relative flex items-center gap-2 bg-[#f5f5f8] px-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {['Agent', 'Agency', 'Company', 'Navigator', 'Search Help'].map((tab, idx) => (
              <div
                key={tab}
                className={`rounded-t-md px-3 py-2 text-sm font-semibold ${
                  idx === 0 ? 'bg-[#fff8d1] text-slate-900 border border-[#d6c35a]' : 'bg-[#0b0b6a] text-white'
                }`}
              >
                {tab}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="absolute right-4 top-3 rounded-full px-2 text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            aria-label="Close agent search"
          >
            ×
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="mt-2 text-sm text-slate-800">
            The information presented is <strong>current as of 12/16/2025.</strong>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 bg-[#0b0b6a] px-3 py-2 text-white text-sm font-semibold">
            <span>Agent Search</span>
            <span className="text-xs font-normal">
              Reset <span className="bg-yellow-300 text-black px-1">Enter Search Criteria to Start Search.</span>
            </span>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-900 font-semibold">
                Virginia License Number
                <input className={input} placeholder="Virginia License Number" value={form.vaLicense} onChange={(e) => handleChange('vaLicense', e.target.value)} />
              </label>
              <label className="text-sm text-slate-900 font-semibold">
                National Producer Number (NPN)
                <input className={input} placeholder="NPN" value={form.npn} onChange={(e) => handleChange('npn', e.target.value)} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
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
                <input className={input} placeholder="First Name" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
              </label>
              <label className="text-sm text-slate-900 font-semibold">
                City
                <input className={input} placeholder="City" value={form.city} onChange={(e) => handleChange('city', e.target.value)} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
            </div>

            <div className="grid gap-3 md:grid-cols-2">
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
              <div className="flex flex-col gap-1">
                <div className="text-center text-xs font-semibold text-slate-700 mt-6 mb-1">OR</div>
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
            </div>

            <div className="flex flex-wrap gap-3 pb-2">
              <button
                type="submit"
                className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
              >
                Search
              </button>
              <button
                type="button"
                className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={reset}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
