import { useState } from 'react'
import { allOccupations, occupationMap } from '../data/occupationMap'

const labelClass = 'text-sm text-slate-900'
const inputClass =
  'h-7 w-40 justify-self-start border border-slate-700/60 bg-white px-2 text-sm text-slate-900 focus:border-[#006aff] focus:outline-none focus:ring-1 focus:ring-[#006aff]/20'
const gridClass = 'grid grid-cols-[150px_1fr] items-center gap-x-4 gap-y-2'
const sectionTitle = 'text-sm font-semibold text-slate-900'
const linkButton = 'text-sm font-semibold text-[#006aff] hover:underline disabled:text-slate-400 disabled:no-underline'
const backButton = 'pill-btn-ghost px-5 py-2 text-sm'
const nextButton = 'pill-btn-primary px-5 py-2 text-sm'
const miniButton = 'pill-btn-ghost px-3 py-1.5 text-xs'
const defaultSelectPlaceholder = '- Please Select -'

const genderOptions = ['Male', 'Female']
const maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Legally Separated', 'Living apart from Spouse']
const driverStatusOptions = [
  'Rated',
  'Under 19 Permit Driver',
  'Under 21 Never Licensed',
  '21+ Never Licensed/Surrendered',
  'Revoked License',
  'Other Insurance',
  'Military deployed spouse',
]
const driversLicenseTypeOptions = [
  'Personal Auto',
  'Commercial Vehicle/Business (non-chauffeur)',
  'Chauffeur/Passenger Transport',
  'Permit',
  'Not Licensed/State ID',
]
const licenseStatusOptions = ['Valid', 'Suspended', 'Revoked', 'Expired', 'Other']
const yearsLicensedOptions = ['3 or more', '2', '1', '0 - 12 months']
const licenseStateOptions = [
  'Virginia',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'Canada',
  'Guam',
  'Puerto Rico',
  'Virgin Islands',
  'Foreign Country',
]
const employmentOptions = [
  'Agriculture/Forestry/Fishing',
  'Art/Design/Media',
  'Banking/Finance/Real Estate',
  'Business/Sales/Office',
  'Construction / Energy / Mining',
  'Education/Library',
  'Engineer/Architect/Science/Math',
  'Food Service / Hotel Services',
  'Government/Military',
  'Homemaker (full-time)',
  'Information Technology',
  'Insurance',
  'Legal/Law Enforcement/Security',
  'Medical/Social Services/Religion',
  'Personal Care/Service',
  'Production / Manufacturing',
  'Repair / Maintenance / Grounds',
  'Retired (full-time)',
  'Sports/Recreation',
  'Student (full-time)',
  'Travel / Transportation / Storage',
  'Unemployed',
]
const educationLevelOptions = [
  'No high school diploma or GED',
  'High school diploma or GED',
  'Vocational or trade school degree',
  'Some college',
  'Currently in college',
  'College degree',
  'Graduate degree',
]
const yesNoOptions = ['No', 'Yes']

const namedInsuredFields = [
  { id: 'ni-first-name', label: 'First Name' },
  { id: 'ni-middle-initial', label: 'Middle Initial' },
  { id: 'ni-last-name', label: 'Last Name' },
  { id: 'ni-suffix', label: 'Suffix' },
  { id: 'ni-dob', label: 'Date of Birth', type: 'date' },
  { id: 'ni-gender', label: 'Gender', options: genderOptions },
  { id: 'ni-marital-status', label: 'Marital Status', options: maritalStatusOptions },
  { id: 'ni-driver-status', label: 'Driver Status', options: driverStatusOptions },
  { id: 'ni-license-type', label: "Driver's License Type", options: driversLicenseTypeOptions },
  { id: 'ni-license-status', label: 'License Status', options: licenseStatusOptions },
  { id: 'ni-years-licensed', label: 'Years Licensed', options: yearsLicensedOptions },
  { id: 'ni-license-state', label: 'License State', options: licenseStateOptions },
  { id: 'ni-license-number', label: 'License Number' },
  { id: 'ni-employment', label: 'Employment', options: employmentOptions },
  { id: 'ni-occupation', label: 'Occupation' },
  { id: 'ni-education-level', label: 'Education Level', options: educationLevelOptions },
  { id: 'ni-accident-prevention', label: 'Accident Prevention Course', options: yesNoOptions },
  { id: 'ni-sr22', label: 'SR-22 Required?', options: yesNoOptions },
  { id: 'ni-fr44', label: 'FR-44 Required?', options: yesNoOptions },
]

function FieldRow({ id, label, type = 'text', value, onChange, placeholder, options, disabled }) {
  const inputProps = value === undefined ? {} : { value, onChange }
  if (options?.length) {
    const selectProps = value === undefined ? { defaultValue: '' } : { value, onChange }
    const selectPlaceholder = placeholder ?? defaultSelectPlaceholder
    return (
      <>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <select id={id} className={inputClass} disabled={disabled} {...selectProps}>
          <option value="">{selectPlaceholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </>
    )
  }
  return (
    <>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} type={type} className={inputClass} placeholder={placeholder} disabled={disabled} {...inputProps} />
    </>
  )
}

export default function CreateProfile() {
  const [currentStep, setCurrentStep] = useState(0)
  const [namedInsured, setNamedInsured] = useState({ employment: '', occupation: '' })
  const [residential, setResidential] = useState({ address1: '', city: '', state: '', zip: '' })
  const [mailing, setMailing] = useState({ address1: '', city: '', state: '', zip: '' })
  const [showResidentialExtra, setShowResidentialExtra] = useState(false)
  const [showMailingExtra, setShowMailingExtra] = useState(false)
  const steps = ['Named Insured', 'Contact Information', 'Addresses']
  const canGoBack = currentStep > 0
  const canGoNext = currentStep < steps.length - 1

  const goBack = () => {
    setCurrentStep((step) => Math.max(0, step - 1))
  }

  const goNext = () => {
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1))
  }

  const specialEmploymentOccupations = {
    'Student (full-time)': ['Student (full-time)'],
    'Retired (full-time)': ['Retired (full-time)'],
  }
  const occupationOptionsForEmployment =
    specialEmploymentOccupations[namedInsured.employment] ||
    (occupationMap[namedInsured.employment]?.length ? occupationMap[namedInsured.employment] : allOccupations)
  const isOccupationLocked = Boolean(specialEmploymentOccupations[namedInsured.employment])

  const handleEmploymentChange = (event) => {
    const nextEmployment = event.target.value
    const nextOptions =
      specialEmploymentOccupations[nextEmployment] ||
      (occupationMap[nextEmployment]?.length ? occupationMap[nextEmployment] : allOccupations)
    const nextOccupation = Array.isArray(nextOptions) && nextOptions.length === 1 ? nextOptions[0] : ''
    setNamedInsured((prev) => ({
      ...prev,
      employment: nextEmployment,
      occupation: nextOptions.includes(prev.occupation) ? prev.occupation : nextOccupation,
    }))
  }

  const namedInsuredFieldsForStep = namedInsuredFields.map((field) => {
    if (field.id === 'ni-employment') {
      return { ...field, value: namedInsured.employment, onChange: handleEmploymentChange }
    }
    if (field.id === 'ni-occupation') {
      return {
        ...field,
        options: occupationOptionsForEmployment,
        value: namedInsured.occupation,
        disabled: isOccupationLocked,
        onChange: (event) => setNamedInsured((prev) => ({ ...prev, occupation: event.target.value })),
      }
    }
    return field
  })

  const handleSameAsResidential = () => {
    setMailing({
      address1: residential.address1,
      city: residential.city,
      state: residential.state,
      zip: residential.zip,
    })
  }

  return (
    <main className="min-h-full">
      <div className="min-h-full w-full border border-slate-300 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
          Create your insurance passport
        </div>

        <div className="mt-1 text-sm text-slate-500">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
        </div>

        {currentStep === 0 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Named Insured</h2>
            <div className={`mt-3 ${gridClass}`}>
              {namedInsuredFieldsForStep.map((field) => (
                <FieldRow key={field.id} {...field} />
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" className={nextButton} onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}

        {currentStep === 1 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Contact Information</h2>
            <div className={`mt-3 ${gridClass}`}>
              <FieldRow id="contact-phone1" label="Phone #1" type="tel" />
              <FieldRow id="contact-phone2" label="Phone #2" type="tel" />
              <FieldRow id="contact-email1" label="Email Address #1" type="email" />
              <FieldRow id="contact-email2" label="Email Address #2" type="email" />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" className={backButton} onClick={goBack} disabled={!canGoBack}>
                Back
              </button>
              <button type="button" className={nextButton} onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Addresses</h2>
            <div className="mt-3 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">Residential Address</div>
                <div className={`mt-3 ${gridClass}`}>
                  <FieldRow
                    id="res-address1"
                    label="Street Address 1"
                    value={residential.address1}
                    onChange={(e) => setResidential((prev) => ({ ...prev, address1: e.target.value }))}
                  />
                  <FieldRow
                    id="res-city"
                    label="City"
                    value={residential.city}
                    onChange={(e) => setResidential((prev) => ({ ...prev, city: e.target.value }))}
                  />
                  <FieldRow
                    id="res-state"
                    label="State"
                    value={residential.state}
                    onChange={(e) => setResidential((prev) => ({ ...prev, state: e.target.value }))}
                  />
                  <FieldRow
                    id="res-zip"
                    label="Zip Code"
                    value={residential.zip}
                    onChange={(e) => setResidential((prev) => ({ ...prev, zip: e.target.value }))}
                  />
                </div>

                <div className="mt-3 flex gap-3">
                  {!showResidentialExtra && (
                    <button type="button" className={miniButton} onClick={() => setShowResidentialExtra(true)}>
                      Add More Address
                    </button>
                  )}
                  {showResidentialExtra && (
                    <button type="button" className={miniButton} onClick={() => setShowResidentialExtra(false)}>
                      Remove Address
                    </button>
                  )}
                </div>

                {showResidentialExtra && (
                  <div className={`mt-3 ${gridClass}`}>
                    <FieldRow id="res2-address1" label="Street Address 1" />
                    <FieldRow id="res2-city" label="City" />
                    <FieldRow id="res2-state" label="State" />
                    <FieldRow id="res2-zip" label="Zip Code" />
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">Mailing Address</div>
                <div className="mt-2">
                  <button type="button" className={miniButton} onClick={handleSameAsResidential}>
                    Same as Residential Address
                  </button>
                </div>
                <div className={`mt-3 ${gridClass}`}>
                  <FieldRow
                    id="mail-address1"
                    label="Street Address 1"
                    value={mailing.address1}
                    onChange={(e) => setMailing((prev) => ({ ...prev, address1: e.target.value }))}
                  />
                  <FieldRow
                    id="mail-city"
                    label="City"
                    value={mailing.city}
                    onChange={(e) => setMailing((prev) => ({ ...prev, city: e.target.value }))}
                  />
                  <FieldRow
                    id="mail-state"
                    label="State"
                    value={mailing.state}
                    onChange={(e) => setMailing((prev) => ({ ...prev, state: e.target.value }))}
                  />
                  <FieldRow
                    id="mail-zip"
                    label="Zip Code"
                    value={mailing.zip}
                    onChange={(e) => setMailing((prev) => ({ ...prev, zip: e.target.value }))}
                  />
                </div>

                <div className="mt-3 flex gap-3">
                  {!showMailingExtra && (
                    <button type="button" className={miniButton} onClick={() => setShowMailingExtra(true)}>
                      Add More Address
                    </button>
                  )}
                  {showMailingExtra && (
                    <button type="button" className={miniButton} onClick={() => setShowMailingExtra(false)}>
                      Remove Address
                    </button>
                  )}
                </div>

                {showMailingExtra && (
                  <div className={`mt-3 ${gridClass}`}>
                    <FieldRow id="mail2-address1" label="Street Address 1" />
                    <FieldRow id="mail2-city" label="City" />
                    <FieldRow id="mail2-state" label="State" />
                    <FieldRow id="mail2-zip" label="Zip Code" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button type="button" className={backButton} onClick={goBack} disabled={!canGoBack}>
                Back
              </button>
              <button type="button" className={nextButton} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
