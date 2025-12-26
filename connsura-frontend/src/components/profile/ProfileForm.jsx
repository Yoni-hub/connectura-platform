import { useState } from 'react'
import { languages } from '../../data/languages'
import { states } from '../../data/states'

const productOptions = [
  'Auto',
  'Home',
  'Renters',
  'Condo',
  'Umbrella',
  'Motorcycle',
  'Commercial Auto',
  'Business Owners',
  'Workers Comp',
  'Life',
  'Health',
  'Pet',
  'Travel',
]

export default function ProfileForm({ initial = {}, onSave, busy }) {
  const [name, setName] = useState(initial.name || '')
  const [preferredLangs, setPreferredLangs] = useState(initial.preferredLangs || ['English'])
  const [coverages, setCoverages] = useState(initial.coverages || ['Liability 100/300'])
  const [priorInsurance, setPriorInsurance] = useState(initial.priorInsurance || [{ carrier: 'Allstate', months: 12 }])
  const [drivers, setDrivers] = useState(initial.drivers?.length ? initial.drivers : [{ name: '', licenseNo: '', birthDate: '', relationship: 'Self' }])
  const [vehicles, setVehicles] = useState(initial.vehicles?.length ? initial.vehicles : [{ year: 2021, make: '', model: '', vin: '', primaryUse: 'Commute' }])
  const profileData = initial.profileData || {}
  const [contact, setContact] = useState(profileData.contact || { phone: '', bestTime: '' })
  const [address, setAddress] = useState(profileData.address || { street: '', city: '', state: '', zip: '' })
  const [property, setProperty] = useState(profileData.property || { type: '', yearBuilt: '', squareFeet: '' })
  const [interests, setInterests] = useState(profileData.interests || ['Auto'])
  const [claimsHistory, setClaimsHistory] = useState(profileData.claimsHistory || '')
  const [notes, setNotes] = useState(profileData.notes || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      name,
      preferredLangs,
      coverages,
      priorInsurance,
      drivers,
      vehicles,
      profileData: {
        contact,
        address,
        property,
        interests,
        claimsHistory,
        notes,
      },
    })
  }

  const updateDriver = (idx, key, value) => {
    setDrivers((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)))
  }
  const updateVehicle = (idx, key, value) => {
    setVehicles((prev) => prev.map((v, i) => (i === idx ? { ...v, [key]: value } : v)))
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Full name
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Preferred languages
          <select
            multiple
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 h-24"
            value={preferredLangs}
            onChange={(e) => setPreferredLangs(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Phone
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Best time to reach you
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={contact.bestTime}
            onChange={(e) => setContact({ ...contact, bestTime: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Street & city
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="123 Main St, City"
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            State
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
            >
              <option value="">Select</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            ZIP
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={address.zip}
              onChange={(e) => setAddress({ ...address, zip: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="font-semibold">Drivers</div>
          {drivers.map((driver, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Name"
                value={driver.name}
                onChange={(e) => updateDriver(idx, 'name', e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="License #"
                value={driver.licenseNo}
                onChange={(e) => updateDriver(idx, 'licenseNo', e.target.value)}
              />
              <input
                type="date"
                className="rounded-lg border border-slate-200 px-3 py-2"
                value={driver.birthDate}
                onChange={(e) => updateDriver(idx, 'birthDate', e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Relationship"
                value={driver.relationship}
                onChange={(e) => updateDriver(idx, 'relationship', e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="text-sm text-primary" onClick={() => setDrivers([...drivers, { name: '', licenseNo: '', birthDate: '', relationship: 'Self' }])}>
            + Add driver
          </button>
        </div>

        <div className="glass rounded-xl p-4 space-y-2">
          <div className="font-semibold">Vehicles</div>
          {vehicles.map((vehicle, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Year"
                value={vehicle.year}
                onChange={(e) => updateVehicle(idx, 'year', Number(e.target.value))}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Make"
                value={vehicle.make}
                onChange={(e) => updateVehicle(idx, 'make', e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Model"
                value={vehicle.model}
                onChange={(e) => updateVehicle(idx, 'model', e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="VIN"
                value={vehicle.vin}
                onChange={(e) => updateVehicle(idx, 'vin', e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2"
                placeholder="Primary use"
                value={vehicle.primaryUse}
                onChange={(e) => updateVehicle(idx, 'primaryUse', e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="text-sm text-primary" onClick={() => setVehicles([...vehicles, { year: 2024, make: '', model: '', vin: '', primaryUse: 'Commute' }])}>
            + Add vehicle
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm block">
          Property details
          <div className="grid grid-cols-2 gap-2 mt-1">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Property type (home, renters, condo)"
              value={property.type}
              onChange={(e) => setProperty({ ...property, type: e.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Year built"
              value={property.yearBuilt}
              onChange={(e) => setProperty({ ...property, yearBuilt: e.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Square feet"
              value={property.squareFeet}
              onChange={(e) => setProperty({ ...property, squareFeet: e.target.value })}
            />
          </div>
        </label>
        <label className="text-sm block">
          Insurance products you need
          <select
            multiple
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 h-28"
            value={interests}
            onChange={(e) => setInterests(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {productOptions.map((prod) => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="glass rounded-xl p-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm block sm:col-span-2">
          Coverages
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={coverages.join(', ')}
            onChange={(e) => setCoverages(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
          />
        </label>
        <label className="text-sm block">
          Prior insurance
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 h-full"
            value={priorInsurance.map((p) => `${p.carrier} ${p.months}mo`).join(', ')}
            onChange={(e) =>
              setPriorInsurance(
                e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .map((entry) => {
                    const [carrier, months] = entry.split(' ')
                    return { carrier, months: Number(months?.replace('mo', '') || 12) }
                  }),
              )
            }
          />
        </label>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <label className="text-sm block">
          Claims history
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={claimsHistory}
            onChange={(e) => setClaimsHistory(e.target.value)}
          />
        </label>
        <label className="text-sm block">
          Additional notes
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">Drivers, vehicles, coverages, and prior insurance stored in the database</div>
        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-white font-semibold disabled:opacity-50">
          {busy ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
