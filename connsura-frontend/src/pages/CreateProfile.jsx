import { useEffect, useRef, useState } from 'react'
import { allOccupations, occupationMap } from '../data/occupationMap'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../services/api'

const labelClass = 'text-sm text-slate-900'
const inputClass =
  'h-7 w-40 justify-self-start border border-slate-700/60 bg-white px-2 text-sm text-slate-900 focus:border-[#006aff] focus:outline-none focus:ring-1 focus:ring-[#006aff]/20'
const gridClass = 'grid grid-cols-[150px_1fr] items-center gap-x-4 gap-y-2'
const sectionTitle = 'text-sm font-semibold text-slate-900'
const linkButton = 'text-sm font-semibold text-[#006aff] hover:underline disabled:text-slate-400 disabled:no-underline'
const backButton = 'pill-btn-ghost px-5 py-2 text-sm'
const nextButton = 'pill-btn-primary px-5 py-2 text-sm'
const miniButton = 'pill-btn-ghost px-3 py-1.5 text-xs'
const tabButton = 'pill-btn-ghost px-2 py-1 text-sm'
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
const relationToApplicantOptions = ['Named Insured', 'Spouse', 'Child', 'Parent', 'Dependent', 'Other']
const businessTypeOptions = ['Sole Proprietor', 'Partnership', 'LLC', 'Corporation', 'Nonprofit', 'Other']
const defaultApplicantRelation = 'Named Insured'

const namedInsuredFields = [
  { id: 'ni-first-name', label: 'First Name' },
  { id: 'ni-middle-initial', label: 'Middle Initial' },
  { id: 'ni-last-name', label: 'Last Name' },
  { id: 'ni-suffix', label: 'Suffix' },
  { id: 'ni-dob', label: 'Date of Birth', type: 'date' },
  { id: 'ni-gender', label: 'Gender', options: genderOptions },
  { id: 'ni-marital-status', label: 'Marital Status', options: maritalStatusOptions },
  { id: 'ni-education-level', label: 'Education Level', options: educationLevelOptions },
  { id: 'ni-employment', label: 'Employment', options: employmentOptions },
  { id: 'ni-occupation', label: 'Occupation' },
  { id: 'ni-driver-status', label: 'Driver Status', options: driverStatusOptions },
  { id: 'ni-license-type', label: "Driver's License Type", options: driversLicenseTypeOptions },
  { id: 'ni-license-status', label: 'License Status', options: licenseStatusOptions },
  { id: 'ni-years-licensed', label: 'Years Licensed', options: yearsLicensedOptions },
  { id: 'ni-license-state', label: 'License State', options: licenseStateOptions },
  { id: 'ni-license-number', label: 'License Number' },
  { id: 'ni-accident-prevention', label: 'Accident Prevention Course', options: yesNoOptions },
  { id: 'ni-sr22', label: 'SR-22 Required?', options: yesNoOptions },
  { id: 'ni-fr44', label: 'FR-44 Required?', options: yesNoOptions },
]

const contactFields = [
  { id: 'phone1', label: 'Phone #1', type: 'tel' },
  { id: 'phone2', label: 'Phone #2', type: 'tel' },
  { id: 'email1', label: 'Email Address #1', type: 'email' },
  { id: 'email2', label: 'Email Address #2', type: 'email' },
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

function QuestionAutocomplete({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const query = (value || '').trim()
    if (query.length < 2) {
      setSuggestions([])
      setOpen(false)
      return undefined
    }
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/questions/search?query=${encodeURIComponent(query)}&limit=8`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const data = await res.json()
        const results = Array.isArray(data.results) ? data.results : []
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions([])
          setOpen(false)
        }
      }
    }, 200)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [value])

  const handleSelect = (text) => {
    onChange(text)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        className={`${inputClass} w-full`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length) setOpen(true)
        }}
        onBlur={() => setOpen(false)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id ?? suggestion.text}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 whitespace-normal break-words"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion.text)}
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const parseSignupName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return { firstName: '', middleInitial: '', lastName: '' }
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleInitial: '', lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const middleInitial = parts.length > 2 ? parts[1][0] : ''
  return { firstName, middleInitial, lastName }
}

export default function CreateProfile() {
  const { user } = useAuth()
  const createContact = () => ({ phone1: '', phone2: '', email1: '', email2: '' })
  const createHouseholdMember = () => ({ relation: '', employment: '', occupation: '' })
  const createVehicle = () => ({ year: '', make: '', model: '', vin: '', primaryUse: '' })
  const createAddressEntry = () => ({
    contact: createContact(),
    residential: { address1: '', city: '', state: '', zip: '' },
    mailing: { address1: '', city: '', state: '', zip: '' },
  })
  const createBusiness = () => ({
    name: '',
    type: '',
    industry: '',
    years: '',
    employees: '',
    phone: '',
    email: '',
    address1: '',
    city: '',
    state: '',
    zip: '',
  })
  const createAdditionalQuestion = () => ({ question: '', input: '' })
  const [activeSection, setActiveSection] = useState(null)
  const [householdComplete, setHouseholdComplete] = useState(false)
  const [addressComplete, setAddressComplete] = useState(false)
  const [vehicleComplete, setVehicleComplete] = useState(false)
  const [businessComplete, setBusinessComplete] = useState(false)
  const [additionalComplete, setAdditionalComplete] = useState(false)
  const [householdEditing, setHouseholdEditing] = useState(false)
  const [addressEditing, setAddressEditing] = useState(false)
  const [vehicleEditing, setVehicleEditing] = useState(false)
  const [businessEditing, setBusinessEditing] = useState(false)
  const [additionalEditing, setAdditionalEditing] = useState(false)
  const [activeHouseholdIndex, setActiveHouseholdIndex] = useState('primary')
  const [activeAddressIndex, setActiveAddressIndex] = useState('primary')
  const [activeVehicleIndex, setActiveVehicleIndex] = useState('primary')
  const [activeBusinessIndex, setActiveBusinessIndex] = useState('primary')
  const [namedInsured, setNamedInsured] = useState({
    relation: defaultApplicantRelation,
    employment: '',
    occupation: '',
  })
  const [additionalHouseholds, setAdditionalHouseholds] = useState([])
  const [newHousehold, setNewHousehold] = useState(createHouseholdMember())
  const [showAddHouseholdModal, setShowAddHouseholdModal] = useState(false)
  const [contacts, setContacts] = useState([createContact()])
  const [residential, setResidential] = useState({ address1: '', city: '', state: '', zip: '' })
  const [mailing, setMailing] = useState({ address1: '', city: '', state: '', zip: '' })
  const [additionalAddresses, setAdditionalAddresses] = useState([])
  const [newAddress, setNewAddress] = useState(createAddressEntry())
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [primaryVehicle, setPrimaryVehicle] = useState(createVehicle())
  const [additionalVehicles, setAdditionalVehicles] = useState([])
  const [newVehicle, setNewVehicle] = useState(createVehicle())
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [primaryBusiness, setPrimaryBusiness] = useState(createBusiness())
  const [additionalBusinesses, setAdditionalBusinesses] = useState([])
  const [newBusiness, setNewBusiness] = useState(createBusiness())
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false)
  const [additionalForms, setAdditionalForms] = useState([])
  const [activeAdditionalFormIndex, setActiveAdditionalFormIndex] = useState(null)
  const [additionalFormName, setAdditionalFormName] = useState('')
  const [additionalQuestions, setAdditionalQuestions] = useState([])
  const prefillKeyRef = useRef('')

  useEffect(() => {
    const identity = user?.email || user?.name
    if (!identity || prefillKeyRef.current === identity) return
    prefillKeyRef.current = identity
    const { firstName, middleInitial, lastName } = parseSignupName(user?.name || '')
    setNamedInsured((prev) => {
      let changed = false
      const next = { ...prev }
      if (!next.relation) {
        next.relation = defaultApplicantRelation
        changed = true
      }
      if (firstName && !next['first-name']) {
        next['first-name'] = firstName
        changed = true
      }
      if (middleInitial && !next['middle-initial']) {
        next['middle-initial'] = middleInitial
        changed = true
      }
      if (lastName && !next['last-name']) {
        next['last-name'] = lastName
        changed = true
      }
      return changed ? next : prev
    })
    if (user?.email) {
      setContacts((prev) => {
        const primary = prev[0] ?? createContact()
        if (primary.email1) return prev
        const next = [...prev]
        next[0] = { ...primary, email1: user.email }
        return next
      })
    }
  }, [user?.email, user?.name])

  const specialEmploymentOccupations = {
    'Student (full-time)': ['Student (full-time)'],
    'Retired (full-time)': ['Retired (full-time)'],
    'Homemaker (full-time)': ['Homemaker (full-time)'],
  }
  const buildHouseholdFields = (person, setPerson, idPrefix) => {
    const occupationOptionsForEmployment =
      specialEmploymentOccupations[person.employment] ||
      (occupationMap[person.employment]?.length ? occupationMap[person.employment] : allOccupations)
    const isOccupationLocked = Boolean(specialEmploymentOccupations[person.employment])

    const handleEmploymentChange = (event) => {
      const nextEmployment = event.target.value
      const nextOptions =
        specialEmploymentOccupations[nextEmployment] ||
        (occupationMap[nextEmployment]?.length ? occupationMap[nextEmployment] : allOccupations)
      const nextOccupation = Array.isArray(nextOptions) && nextOptions.length === 1 ? nextOptions[0] : ''
      setPerson((prev) => ({
        ...prev,
        employment: nextEmployment,
        occupation: nextOptions.includes(prev.occupation) ? prev.occupation : nextOccupation,
      }))
    }

    return namedInsuredFields.map((field) => {
      const fieldKey = field.id.replace(/^ni-/, '')
      const fieldId = field.id.replace(/^ni-/, `${idPrefix}-`)
      if (fieldKey === 'employment') {
        return { ...field, id: fieldId, value: person.employment ?? '', onChange: handleEmploymentChange }
      }
      if (fieldKey === 'occupation') {
        return {
          ...field,
          id: fieldId,
          options: occupationOptionsForEmployment,
          value: person.occupation ?? '',
          disabled: isOccupationLocked,
          onChange: (event) => setPerson((prev) => ({ ...prev, occupation: event.target.value })),
        }
      }
      return {
        ...field,
        id: fieldId,
        value: person[fieldKey] ?? '',
        onChange: (event) => setPerson((prev) => ({ ...prev, [fieldKey]: event.target.value })),
      }
    })
  }

  const newHouseholdFields = buildHouseholdFields(newHousehold, setNewHousehold, 'hh-new')
  const updateAdditionalHousehold = (index, updater) => {
    setAdditionalHouseholds((prev) => {
      const next = [...prev]
      const current = next[index] ?? createHouseholdMember()
      const nextPerson = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextPerson
      return next
    })
  }

  const updateContact = (index, updater) => {
    setContacts((prev) => {
      const next = [...prev]
      const current = next[index] ?? createContact()
      const nextContact = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextContact
      return next
    })
  }

  const updateAdditionalAddress = (index, updater) => {
    setAdditionalAddresses((prev) => {
      const next = [...prev]
      const current = next[index] ?? createAddressEntry()
      const nextEntry = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextEntry
      return next
    })
  }

  const updateAdditionalVehicle = (index, updater) => {
    setAdditionalVehicles((prev) => {
      const next = [...prev]
      const current = next[index] ?? createVehicle()
      const nextVehicle = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextVehicle
      return next
    })
  }

  const updateAdditionalBusiness = (index, updater) => {
    setAdditionalBusinesses((prev) => {
      const next = [...prev]
      const current = next[index] ?? createBusiness()
      const nextBusiness = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextBusiness
      return next
    })
  }

  const removeAdditionalHousehold = (index) => {
    setAdditionalHouseholds((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalAddress = (index) => {
    setAdditionalAddresses((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalVehicle = (index) => {
    setAdditionalVehicles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalBusiness = (index) => {
    setAdditionalBusinesses((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalForm = (index) => {
    setAdditionalForms((prev) => prev.filter((_, idx) => idx !== index))
  }

  const addAdditionalQuestion = () => {
    setAdditionalQuestions((prev) => [...prev, createAdditionalQuestion()])
  }

  const removeAdditionalQuestion = () => {
    setAdditionalQuestions((prev) => (prev.length ? prev.slice(0, -1) : prev))
  }

  const updateAdditionalQuestion = (index, field, value) => {
    setAdditionalQuestions((prev) => {
      const next = [...prev]
      const current = next[index] ?? createAdditionalQuestion()
      next[index] = { ...current, [field]: value }
      return next
    })
  }

  const saveCustomerQuestions = async (questions) => {
    const cleaned = questions
      .map((question) => (question || '').toString().trim())
      .filter(Boolean)
    if (!cleaned.length) return
    try {
      await fetch(`${API_URL}/questions/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: cleaned }),
      })
    } catch (error) {
      console.warn('Failed to save customer questions', error)
    }
  }

  const editAdditionalForm = (index) => {
    const form = additionalForms[index] ?? { name: '', questions: [] }
    setActiveAdditionalFormIndex(index)
    setAdditionalFormName(form.name ?? '')
    setAdditionalQuestions(form.questions ?? [])
    setAdditionalEditing(true)
  }

  const startNewAdditionalForm = () => {
    setActiveAdditionalFormIndex(null)
    setAdditionalFormName('')
    setAdditionalQuestions([])
    setAdditionalEditing(true)
  }

  const openSection = (section) => {
    setActiveSection(section)
    setShowAddHouseholdModal(false)
    setShowAddAddressModal(false)
    setShowAddVehicleModal(false)
    setShowAddBusinessModal(false)
    setHouseholdEditing(false)
    setAddressEditing(false)
    setVehicleEditing(false)
    setBusinessEditing(false)
    if (section === 'household') {
      setActiveHouseholdIndex('primary')
      setHouseholdEditing(!householdComplete)
    }
    if (section === 'address') {
      setActiveAddressIndex('primary')
      setAddressEditing(!addressComplete)
    }
    if (section === 'vehicle') {
      setActiveVehicleIndex('primary')
      setVehicleEditing(!vehicleComplete)
    }
    if (section === 'business') {
      setActiveBusinessIndex('primary')
      setBusinessEditing(!businessComplete)
    }
    if (section === 'additional') {
      setAdditionalEditing(!additionalComplete)
    }
  }

  const handleSameAsResidential = () => {
    if (activeAddressIndex === 'primary') {
      setMailing({
        address1: residential.address1,
        city: residential.city,
        state: residential.state,
        zip: residential.zip,
      })
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      mailing: {
        address1: prev.residential?.address1 ?? '',
        city: prev.residential?.city ?? '',
        state: prev.residential?.state ?? '',
        zip: prev.residential?.zip ?? '',
      },
    }))
  }

  const namedInsuredLabel = namedInsured.relation ? namedInsured.relation : 'Primary Applicant'
  const getAdditionalHouseholdLabel = (relation) => (relation ? relation : 'Additional Household Member')
  const activeAdditionalIndex = typeof activeHouseholdIndex === 'number' ? activeHouseholdIndex : null
  const activeAdditionalPerson =
    activeAdditionalIndex !== null ? additionalHouseholds[activeAdditionalIndex] : null
  const activeHousehold =
    activeHouseholdIndex === 'primary' || !activeAdditionalPerson
      ? {
          person: namedInsured,
          setPerson: setNamedInsured,
          label: namedInsuredLabel,
          idPrefix: 'hh1',
        }
      : {
          person: activeAdditionalPerson,
          setPerson: (updater) => updateAdditionalHousehold(activeAdditionalIndex, updater),
          label: getAdditionalHouseholdLabel(activeAdditionalPerson.relation),
          idPrefix: `hh2-${activeAdditionalIndex + 1}`,
        }
  const activeHouseholdFields = buildHouseholdFields(
    activeHousehold.person,
    activeHousehold.setPerson,
    activeHousehold.idPrefix
  )
  const primaryContact = contacts[0] || createContact()
  const primaryAddressLabel = 'Primary Address'
  const getAdditionalAddressLabel = (index) => `Additional Address ${index + 1}`
  const activeAdditionalAddressIndex = typeof activeAddressIndex === 'number' ? activeAddressIndex : null
  const activeAdditionalAddress =
    activeAdditionalAddressIndex !== null ? additionalAddresses[activeAdditionalAddressIndex] : null
  const activeAddressEntry = activeAdditionalAddress ?? createAddressEntry()
  const activeAddressLabel =
    activeAdditionalAddressIndex === null ? primaryAddressLabel : getAdditionalAddressLabel(activeAdditionalAddressIndex)
  const activeAddressContact =
    activeAdditionalAddressIndex === null ? primaryContact : activeAddressEntry.contact
  const activeAddressResidential =
    activeAdditionalAddressIndex === null ? residential : activeAddressEntry.residential
  const activeAddressMailing = activeAdditionalAddressIndex === null ? mailing : activeAddressEntry.mailing
  const primaryVehicleLabel = 'Primary Vehicle'
  const getAdditionalVehicleLabel = (index) => `Additional Vehicle ${index + 1}`
  const activeAdditionalVehicleIndex = typeof activeVehicleIndex === 'number' ? activeVehicleIndex : null
  const activeAdditionalVehicle =
    activeAdditionalVehicleIndex !== null ? additionalVehicles[activeAdditionalVehicleIndex] : null
  const activeVehicle =
    activeAdditionalVehicleIndex === null ? primaryVehicle : activeAdditionalVehicle ?? createVehicle()
  const activeVehicleLabel =
    activeAdditionalVehicleIndex === null ? primaryVehicleLabel : getAdditionalVehicleLabel(activeAdditionalVehicleIndex)
  const primaryBusinessLabel = 'Primary Business'
  const getAdditionalBusinessLabel = (index) => `Additional Business ${index + 1}`
  const activeAdditionalBusinessIndex = typeof activeBusinessIndex === 'number' ? activeBusinessIndex : null
  const activeAdditionalBusiness =
    activeAdditionalBusinessIndex !== null ? additionalBusinesses[activeAdditionalBusinessIndex] : null
  const activeBusiness =
    activeAdditionalBusinessIndex === null ? primaryBusiness : activeAdditionalBusiness ?? createBusiness()
  const activeBusinessLabel =
    activeAdditionalBusinessIndex === null ? primaryBusinessLabel : getAdditionalBusinessLabel(activeAdditionalBusinessIndex)
  const showHouseholdSection = activeSection === 'household'
  const showAddressSection = activeSection === 'address'
  const showVehicleSection = activeSection === 'vehicle'
  const showBusinessSection = activeSection === 'business'
  const showHouseholdForm =
    showHouseholdSection && (!householdComplete || householdEditing) && !showAddHouseholdModal
  const showHouseholdSummary =
    showHouseholdSection && householdComplete && !householdEditing && !showAddHouseholdModal
  const showAddressForm = showAddressSection && (!addressComplete || addressEditing) && !showAddAddressModal
  const showAddressSummary = showAddressSection && addressComplete && !addressEditing && !showAddAddressModal
  const showVehicleForm = showVehicleSection && (!vehicleComplete || vehicleEditing) && !showAddVehicleModal
  const showVehicleSummary = showVehicleSection && vehicleComplete && !vehicleEditing && !showAddVehicleModal
  const showBusinessForm = showBusinessSection && (!businessComplete || businessEditing) && !showAddBusinessModal
  const showBusinessSummary = showBusinessSection && businessComplete && !businessEditing && !showAddBusinessModal
  const showAdditionalSection = activeSection === 'additional'
  const showSummarySection = activeSection === 'summary'
  const showAdditionalForm = showAdditionalSection && (!additionalComplete || additionalEditing)
  const showAdditionalSummary = showAdditionalSection && additionalComplete && !additionalEditing
  const setActiveAddressContactField = (field, value) => {
    if (activeAddressIndex === 'primary') {
      updateContact(0, (prev) => ({ ...prev, [field]: value }))
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      contact: { ...(prev.contact ?? createContact()), [field]: value },
    }))
  }
  const setActiveAddressResidentialField = (field, value) => {
    if (activeAddressIndex === 'primary') {
      setResidential((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      residential: { ...(prev.residential ?? { address1: '', city: '', state: '', zip: '' }), [field]: value },
    }))
  }
  const setActiveAddressMailingField = (field, value) => {
    if (activeAddressIndex === 'primary') {
      setMailing((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      mailing: { ...(prev.mailing ?? { address1: '', city: '', state: '', zip: '' }), [field]: value },
    }))
  }
  const setActiveVehicleField = (field, value) => {
    if (activeVehicleIndex === 'primary') {
      setPrimaryVehicle((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (typeof activeVehicleIndex !== 'number') {
      return
    }
    updateAdditionalVehicle(activeVehicleIndex, (prev) => ({ ...prev, [field]: value }))
  }
  const setActiveBusinessField = (field, value) => {
    if (activeBusinessIndex === 'primary') {
      setPrimaryBusiness((prev) => ({ ...prev, [field]: value }))
      return
    }
    if (typeof activeBusinessIndex !== 'number') {
      return
    }
    updateAdditionalBusiness(activeBusinessIndex, (prev) => ({ ...prev, [field]: value }))
  }
  const businessFields = [
    { id: 'name', label: 'Business Name' },
    { id: 'type', label: 'Business Type', options: businessTypeOptions },
    { id: 'industry', label: 'Industry' },
    { id: 'years', label: 'Years in Business' },
    { id: 'employees', label: 'Number of Employees' },
    { id: 'phone', label: 'Business Phone', type: 'tel' },
    { id: 'email', label: 'Business Email', type: 'email' },
    { id: 'address1', label: 'Street Address 1' },
    { id: 'city', label: 'City' },
    { id: 'state', label: 'State', options: licenseStateOptions },
    { id: 'zip', label: 'Zip Code' },
  ]
  const buildFullName = (person) => {
    const nameParts = [person['first-name'], person['middle-initial'], person['last-name']].filter(Boolean)
    const baseName = nameParts.join(' ')
    if (!person.suffix) {
      return baseName
    }
    return baseName ? `${baseName}, ${person.suffix}` : person.suffix
  }
  const primaryFullName = buildFullName(namedInsured)
  const summaryValue = (value) => (value ? value : '-')

  return (
    <main className="min-h-full">
      <div className="min-h-full w-full border border-slate-300 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
          Create your insurance passport
        </div>
        <nav className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <button
            type="button"
            className={`${tabButton} w-full`}
            onClick={() => openSection('household')}
          >
            Household information
          </button>
          <button
            type="button"
            className={`${tabButton} w-full`}
            onClick={() => openSection('address')}
          >
            Address information
          </button>
          <button type="button" className={`${tabButton} w-full`} onClick={() => openSection('additional')}>
            Additional information
          </button>
          <button type="button" className={`${tabButton} w-full`} onClick={() => openSection('summary')}>
            Summary
          </button>
        </nav>

        {showHouseholdSection && (
          <>
            {showAddHouseholdModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Household Member</div>
                    <div className={gridClass}>
                      <FieldRow
                        id="hh-new-relation"
                        label="Relation To Applicant"
                        options={relationToApplicantOptions}
                        value={newHousehold.relation}
                        onChange={(event) => setNewHousehold((prev) => ({ ...prev, relation: event.target.value }))}
                      />
                      {newHouseholdFields.map((field) => (
                        <FieldRow key={field.id} {...field} />
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setShowAddHouseholdModal(false)
                          setNewHousehold(createHouseholdMember())
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setAdditionalHouseholds((prev) => [...prev, newHousehold])
                          setShowAddHouseholdModal(false)
                          setNewHousehold(createHouseholdMember())
                          setHouseholdComplete(true)
                          setActiveHouseholdIndex('primary')
                          setHouseholdEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showHouseholdForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Household Information</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeHousehold.label}</div>
                      <div className={`mt-3 ${gridClass}`}>
                        <FieldRow
                          id={`${activeHousehold.idPrefix}-relation`}
                          label="Relation To Applicant"
                          options={relationToApplicantOptions}
                          value={activeHousehold.person.relation}
                          onChange={(event) =>
                            activeHousehold.setPerson((prev) => ({ ...prev, relation: event.target.value }))
                          }
                        />
                        {activeHouseholdFields.map((field) => (
                          <FieldRow key={field.id} {...field} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (householdComplete) {
                            setHouseholdEditing(false)
                          } else {
                            setActiveSection(null)
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setHouseholdComplete(true)
                          setHouseholdEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showHouseholdSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{namedInsuredLabel}</div>
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setActiveHouseholdIndex('primary')
                          setHouseholdEditing(true)
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">Full Name:</span> {summaryValue(primaryFullName)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Birthday:</span> {summaryValue(namedInsured.dob)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Sex:</span> {summaryValue(namedInsured.gender)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">License Number:</span>{' '}
                        {summaryValue(namedInsured['license-number'])}
                      </div>
                    </div>
                  </div>

                  {additionalHouseholds.map((person, index) => {
                    const additionalTitle = person.relation
                      ? person.relation
                      : `Additional Household Member ${index + 1}`
                    const fullName = buildFullName(person)
                    return (
                      <div
                        key={`household-summary-${index}`}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-900">{additionalTitle}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={miniButton}
                              onClick={() => {
                                setActiveHouseholdIndex(index)
                                setHouseholdEditing(true)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={miniButton}
                              onClick={() => removeAdditionalHousehold(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                          <div>
                            <span className="font-semibold text-slate-900">Full Name:</span> {summaryValue(fullName)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Birthday:</span> {summaryValue(person.dob)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Sex:</span> {summaryValue(person.gender)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">License Number:</span>{' '}
                            {summaryValue(person['license-number'])}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className={miniButton}
                      onClick={() => {
                        setNewHousehold(createHouseholdMember())
                        setShowAddHouseholdModal(true)
                      }}
                    >
                      Add more people
                    </button>
                    <button
                      type="button"
                      className={nextButton}
                      onClick={() => {
                        setActiveSection('address')
                        setActiveAddressIndex('primary')
                        setAddressEditing(true)
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
        {showAddressSection && (
          <>
            {showAddAddressModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Address</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Contact Information</div>
                      <div className={`mt-3 ${gridClass}`}>
                        {contactFields.map((field) => (
                          <FieldRow
                            key={`new-address-contact-${field.id}`}
                            id={`new-address-${field.id}`}
                            label={field.label}
                            type={field.type}
                            value={newAddress.contact?.[field.id] ?? ''}
                            onChange={(event) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                contact: { ...(prev.contact ?? createContact()), [field.id]: event.target.value },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Residential Address</div>
                        <div className={`mt-3 ${gridClass}`}>
                          <FieldRow
                            id="new-res-address1"
                            label="Street Address 1"
                            value={newAddress.residential?.address1 ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                residential: { ...(prev.residential ?? {}), address1: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-res-city"
                            label="City"
                            value={newAddress.residential?.city ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                residential: { ...(prev.residential ?? {}), city: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-res-state"
                            label="State"
                            value={newAddress.residential?.state ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                residential: { ...(prev.residential ?? {}), state: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-res-zip"
                            label="Zip Code"
                            value={newAddress.residential?.zip ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                residential: { ...(prev.residential ?? {}), zip: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-slate-900">Mailing Address</div>
                        <div className="mt-2">
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() =>
                              setNewAddress((prev) => ({
                                ...prev,
                                mailing: { ...(prev.residential ?? {}) },
                              }))
                            }
                          >
                            Same as Residential Address
                          </button>
                        </div>
                        <div className={`mt-3 ${gridClass}`}>
                          <FieldRow
                            id="new-mail-address1"
                            label="Street Address 1"
                            value={newAddress.mailing?.address1 ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                mailing: { ...(prev.mailing ?? {}), address1: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-mail-city"
                            label="City"
                            value={newAddress.mailing?.city ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                mailing: { ...(prev.mailing ?? {}), city: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-mail-state"
                            label="State"
                            value={newAddress.mailing?.state ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                mailing: { ...(prev.mailing ?? {}), state: e.target.value },
                              }))
                            }
                          />
                          <FieldRow
                            id="new-mail-zip"
                            label="Zip Code"
                            value={newAddress.mailing?.zip ?? ''}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                mailing: { ...(prev.mailing ?? {}), zip: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setShowAddAddressModal(false)
                          setNewAddress(createAddressEntry())
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setAdditionalAddresses((prev) => [...prev, newAddress])
                          setShowAddAddressModal(false)
                          setNewAddress(createAddressEntry())
                          setAddressComplete(true)
                          setActiveAddressIndex('primary')
                          setAddressEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}
            {showAddressForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Address Information</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeAddressLabel}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Contact Information</div>
                      <div className={`mt-3 ${gridClass}`}>
                        {contactFields.map((field) => (
                          <FieldRow
                            key={`contact-0-${field.id}`}
                            id={`contact-0-${field.id}`}
                            label={field.label}
                            type={field.type}
                            value={activeAddressContact?.[field.id] ?? ''}
                            onChange={(event) => setActiveAddressContactField(field.id, event.target.value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Residential Address</div>
                        <div className={`mt-3 ${gridClass}`}>
                          <FieldRow
                            id="res-address1"
                            label="Street Address 1"
                            value={activeAddressResidential?.address1 ?? ''}
                            onChange={(e) => setActiveAddressResidentialField('address1', e.target.value)}
                          />
                          <FieldRow
                            id="res-city"
                            label="City"
                            value={activeAddressResidential?.city ?? ''}
                            onChange={(e) => setActiveAddressResidentialField('city', e.target.value)}
                          />
                          <FieldRow
                            id="res-state"
                            label="State"
                            value={activeAddressResidential?.state ?? ''}
                            onChange={(e) => setActiveAddressResidentialField('state', e.target.value)}
                          />
                          <FieldRow
                            id="res-zip"
                            label="Zip Code"
                            value={activeAddressResidential?.zip ?? ''}
                            onChange={(e) => setActiveAddressResidentialField('zip', e.target.value)}
                          />
                        </div>
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
                            value={activeAddressMailing?.address1 ?? ''}
                            onChange={(e) => setActiveAddressMailingField('address1', e.target.value)}
                          />
                          <FieldRow
                            id="mail-city"
                            label="City"
                            value={activeAddressMailing?.city ?? ''}
                            onChange={(e) => setActiveAddressMailingField('city', e.target.value)}
                          />
                          <FieldRow
                            id="mail-state"
                            label="State"
                            value={activeAddressMailing?.state ?? ''}
                            onChange={(e) => setActiveAddressMailingField('state', e.target.value)}
                          />
                          <FieldRow
                            id="mail-zip"
                            label="Zip Code"
                            value={activeAddressMailing?.zip ?? ''}
                            onChange={(e) => setActiveAddressMailingField('zip', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (addressComplete) {
                            setAddressEditing(false)
                          } else {
                            setActiveSection(null)
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setAddressComplete(true)
                          setAddressEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showAddressSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{primaryAddressLabel}</div>
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setActiveAddressIndex('primary')
                          setAddressEditing(true)
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">Phone #1:</span>{' '}
                        {summaryValue(primaryContact.phone1)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Email Address #1:</span>{' '}
                        {summaryValue(primaryContact.email1)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
                        {summaryValue(residential.address1)}
                      </div>
                    </div>
                  </div>

                  {additionalAddresses.map((address, index) => (
                    <div
                      key={`address-summary-${index}`}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          {getAdditionalAddressLabel(index)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => {
                              setActiveAddressIndex(index)
                              setAddressEditing(true)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => removeAdditionalAddress(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900">Phone #1:</span>{' '}
                          {summaryValue(address.contact?.phone1)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Email Address #1:</span>{' '}
                          {summaryValue(address.contact?.email1)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
                          {summaryValue(address.residential?.address1)}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className={miniButton}
                      onClick={() => {
                        setNewAddress(createAddressEntry())
                        setShowAddAddressModal(true)
                      }}
                    >
                      Add more address
                    </button>
                    <button
                      type="button"
                      className={nextButton}
                      onClick={() => {
                        openSection('additional')
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {showVehicleSection && (
          <>
            {showAddVehicleModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Vehicle</div>
                    <div className={`mt-3 ${gridClass}`}>
                      <FieldRow
                        id="new-vehicle-year"
                        label="Year"
                        type="number"
                        value={newVehicle.year}
                        onChange={(event) => setNewVehicle((prev) => ({ ...prev, year: event.target.value }))}
                      />
                      <FieldRow
                        id="new-vehicle-make"
                        label="Make"
                        value={newVehicle.make}
                        onChange={(event) => setNewVehicle((prev) => ({ ...prev, make: event.target.value }))}
                      />
                      <FieldRow
                        id="new-vehicle-model"
                        label="Model"
                        value={newVehicle.model}
                        onChange={(event) => setNewVehicle((prev) => ({ ...prev, model: event.target.value }))}
                      />
                      <FieldRow
                        id="new-vehicle-vin"
                        label="VIN"
                        value={newVehicle.vin}
                        onChange={(event) => setNewVehicle((prev) => ({ ...prev, vin: event.target.value }))}
                      />
                      <FieldRow
                        id="new-vehicle-primary-use"
                        label="Primary Use"
                        value={newVehicle.primaryUse}
                        onChange={(event) => setNewVehicle((prev) => ({ ...prev, primaryUse: event.target.value }))}
                      />
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setShowAddVehicleModal(false)
                          setNewVehicle(createVehicle())
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setAdditionalVehicles((prev) => [...prev, newVehicle])
                          setShowAddVehicleModal(false)
                          setNewVehicle(createVehicle())
                          setVehicleComplete(true)
                          setActiveVehicleIndex('primary')
                          setVehicleEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}
            {showVehicleForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Vehicle Information</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeVehicleLabel}</div>
                      <div className={`mt-3 ${gridClass}`}>
                        <FieldRow
                          id="vehicle-year"
                          label="Year"
                          type="number"
                          value={activeVehicle.year}
                          onChange={(event) => setActiveVehicleField('year', event.target.value)}
                        />
                        <FieldRow
                          id="vehicle-make"
                          label="Make"
                          value={activeVehicle.make}
                          onChange={(event) => setActiveVehicleField('make', event.target.value)}
                        />
                        <FieldRow
                          id="vehicle-model"
                          label="Model"
                          value={activeVehicle.model}
                          onChange={(event) => setActiveVehicleField('model', event.target.value)}
                        />
                        <FieldRow
                          id="vehicle-vin"
                          label="VIN"
                          value={activeVehicle.vin}
                          onChange={(event) => setActiveVehicleField('vin', event.target.value)}
                        />
                        <FieldRow
                          id="vehicle-primary-use"
                          label="Primary Use"
                          value={activeVehicle.primaryUse}
                          onChange={(event) => setActiveVehicleField('primaryUse', event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (vehicleComplete) {
                            setVehicleEditing(false)
                          } else {
                            setActiveSection(null)
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setVehicleComplete(true)
                          setVehicleEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showVehicleSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{primaryVehicleLabel}</div>
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setActiveVehicleIndex('primary')
                          setVehicleEditing(true)
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">Year:</span> {summaryValue(primaryVehicle.year)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Make:</span> {summaryValue(primaryVehicle.make)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Model:</span> {summaryValue(primaryVehicle.model)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">VIN:</span> {summaryValue(primaryVehicle.vin)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Primary Use:</span>{' '}
                        {summaryValue(primaryVehicle.primaryUse)}
                      </div>
                    </div>
                  </div>

                  {additionalVehicles.map((vehicle, index) => (
                    <div
                      key={`vehicle-summary-${index}`}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">{getAdditionalVehicleLabel(index)}</div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => {
                              setActiveVehicleIndex(index)
                              setVehicleEditing(true)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => removeAdditionalVehicle(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900">Year:</span> {summaryValue(vehicle.year)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Make:</span> {summaryValue(vehicle.make)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Model:</span> {summaryValue(vehicle.model)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">VIN:</span> {summaryValue(vehicle.vin)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Primary Use:</span>{' '}
                          {summaryValue(vehicle.primaryUse)}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className={miniButton}
                      onClick={() => {
                        setNewVehicle(createVehicle())
                        setShowAddVehicleModal(true)
                      }}
                    >
                      Add more vehicle
                    </button>
                    <button
                      type="button"
                      className={nextButton}
                      onClick={() => {
                        setActiveSection('business')
                        setActiveBusinessIndex('primary')
                        setBusinessEditing(!businessComplete)
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {showBusinessSection && (
          <>
            {showAddBusinessModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Business</div>
                    <div className={gridClass}>
                      {businessFields.map((field) => (
                        <FieldRow
                          key={`new-business-${field.id}`}
                          id={`new-business-${field.id}`}
                          label={field.label}
                          type={field.type}
                          options={field.options}
                          value={newBusiness[field.id] ?? ''}
                          onChange={(event) =>
                            setNewBusiness((prev) => ({ ...prev, [field.id]: event.target.value }))
                          }
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setShowAddBusinessModal(false)
                          setNewBusiness(createBusiness())
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setAdditionalBusinesses((prev) => [...prev, newBusiness])
                          setShowAddBusinessModal(false)
                          setNewBusiness(createBusiness())
                          setBusinessComplete(true)
                          setActiveBusinessIndex('primary')
                          setBusinessEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showBusinessForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Business Information</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeBusinessLabel}</div>
                      <div className={`mt-3 ${gridClass}`}>
                        {businessFields.map((field) => (
                          <FieldRow
                            key={`business-${field.id}`}
                            id={`business-${field.id}`}
                            label={field.label}
                            type={field.type}
                            options={field.options}
                            value={activeBusiness[field.id] ?? ''}
                            onChange={(event) => setActiveBusinessField(field.id, event.target.value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (businessComplete) {
                            setBusinessEditing(false)
                          } else {
                            setActiveSection(null)
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={() => {
                          setBusinessComplete(true)
                          setBusinessEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showBusinessSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{primaryBusinessLabel}</div>
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          setActiveBusinessIndex('primary')
                          setBusinessEditing(true)
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">Business Name:</span>{' '}
                        {summaryValue(primaryBusiness.name)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Type:</span>{' '}
                        {summaryValue(primaryBusiness.type)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Phone:</span>{' '}
                        {summaryValue(primaryBusiness.phone)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
                        {summaryValue(primaryBusiness.address1)}
                      </div>
                    </div>
                  </div>

                  {additionalBusinesses.map((business, index) => (
                    <div
                      key={`business-summary-${index}`}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          {getAdditionalBusinessLabel(index)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => {
                              setActiveBusinessIndex(index)
                              setBusinessEditing(true)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={miniButton}
                            onClick={() => removeAdditionalBusiness(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900">Business Name:</span>{' '}
                          {summaryValue(business.name)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Type:</span>{' '}
                          {summaryValue(business.type)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Phone:</span>{' '}
                          {summaryValue(business.phone)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
                          {summaryValue(business.address1)}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className={miniButton}
                      onClick={() => {
                        setNewBusiness(createBusiness())
                        setShowAddBusinessModal(true)
                      }}
                    >
                      Add more business
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {showAdditionalSection && (
          <>
            {showAdditionalForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Information</div>
                    <div className={gridClass}>
                      <FieldRow
                        id="additional-form-name"
                        label="Give your form a name"
                        value={additionalFormName}
                        onChange={(event) => setAdditionalFormName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      {additionalQuestions.map((question, index) => (
                        <div
                          key={`additional-question-${index}`}
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
                        >
                          <QuestionAutocomplete
                            value={question.question}
                            placeholder="Question"
                            onChange={(value) => updateAdditionalQuestion(index, 'question', value)}
                          />
                          <input
                            className={`${inputClass} w-full`}
                            placeholder="Input field"
                            value={question.input}
                            onChange={(event) => updateAdditionalQuestion(index, 'input', event.target.value)}
                          />
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-3">
                        <button type="button" className={miniButton} onClick={addAdditionalQuestion}>
                          Add question
                        </button>
                        <button
                          type="button"
                          className={miniButton}
                          onClick={removeAdditionalQuestion}
                          disabled={!additionalQuestions.length}
                        >
                          Remove question
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (additionalComplete) {
                            setAdditionalEditing(false)
                          } else {
                            setActiveSection(null)
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={async () => {
                          await saveCustomerQuestions(additionalQuestions.map((question) => question.question))
                          const nextForm = { name: additionalFormName, questions: additionalQuestions }
                          if (typeof activeAdditionalFormIndex === 'number') {
                            setAdditionalForms((prev) => {
                              const next = [...prev]
                              next[activeAdditionalFormIndex] = nextForm
                              return next
                            })
                          } else {
                            setAdditionalForms((prev) => [...prev, nextForm])
                          }
                          setActiveAdditionalFormIndex(null)
                          setAdditionalComplete(true)
                          setAdditionalEditing(false)
                        }}
                      >
                        Save &amp; Continue
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showAdditionalSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  {additionalForms.length > 0 ? (
                    additionalForms.map((form, index) => (
                      <div
                        key={`additional-form-${index}`}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-900">
                            {form.name || `Additional Form ${index + 1}`}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className={miniButton} onClick={() => editAdditionalForm(index)}>
                              Edit
                            </button>
                            <button type="button" className={miniButton} onClick={() => removeAdditionalForm(index)}>
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-3 text-sm text-slate-700">
                          {(form.questions ?? []).length > 0 ? (
                            <div className="flex flex-nowrap gap-6 overflow-x-auto pb-1">
                              {(form.questions ?? []).slice(0, 3).map((question, questionIndex) => (
                                <div
                                  key={`additional-summary-${index}-${questionIndex}`}
                                  className="flex items-center gap-3 text-sm text-slate-700 whitespace-nowrap"
                                >
                                  <span className="font-semibold text-slate-900">
                                    {summaryValue(question.question)}:
                                  </span>
                                  <span>{summaryValue(question.input)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-500">No additional questions added.</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">No additional forms added.</div>
                  )}
                  <div className="flex flex-wrap justify-end gap-3">
                    <button type="button" className={miniButton} onClick={startNewAdditionalForm}>
                      Add more forms
                    </button>
                    <button type="button" className={nextButton} onClick={() => openSection('summary')}>
                      Continue
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {showSummarySection && (
          <section className="mt-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-900">Summary</div>

              <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Household information</div>
                  <button type="button" className={miniButton} onClick={() => openSection('household')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Full Name:</span> {summaryValue(primaryFullName)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Birthday:</span> {summaryValue(namedInsured.dob)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Sex:</span> {summaryValue(namedInsured.gender)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">License Number:</span>{' '}
                    {summaryValue(namedInsured['license-number'])}
                  </div>
                </div>
                {additionalHouseholds.length ? (
                  <div className="mt-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Additional members:</span>{' '}
                    {additionalHouseholds
                      .map((person) => buildFullName(person))
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">No additional household members.</div>
                )}
              </div>

              <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Address information</div>
                  <button type="button" className={miniButton} onClick={() => openSection('address')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Phone #1:</span> {summaryValue(primaryContact.phone1)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Email Address #1:</span>{' '}
                    {summaryValue(primaryContact.email1)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
                    {summaryValue(residential.address1)}
                  </div>
                </div>
                {additionalAddresses.length ? (
                  <div className="mt-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Additional addresses:</span>{' '}
                    {additionalAddresses.length}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">No additional addresses.</div>
                )}
              </div>

              <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Additional information</div>
                  <button type="button" className={miniButton} onClick={() => openSection('additional')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {additionalForms.length ? (
                    additionalForms.map((form, index) => (
                      <div key={`summary-form-${index}`} className="flex flex-wrap gap-2">
                        <span className="font-semibold text-slate-900">
                          {form.name || `Form ${index + 1}`}:
                        </span>
                        <span>{(form.questions ?? []).length} question(s)</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">No additional forms added.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
