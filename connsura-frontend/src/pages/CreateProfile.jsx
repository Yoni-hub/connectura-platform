import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { allOccupations, occupationMap } from '../data/occupationMap'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../services/api'
import { getStoredToken } from '../utils/authStorage'

const labelClass = 'text-sm text-slate-900'
const inputClass =
  'h-7 w-40 justify-self-start border border-slate-700/60 bg-white px-2 text-sm text-slate-900 focus:border-[#006aff] focus:outline-none focus:ring-1 focus:ring-[#006aff]/20'
const additionalQuestionInputClass =
  'justify-self-start border-0 bg-transparent px-0 text-sm text-[#006aff] placeholder:text-[#7fb2ff] focus:outline-none focus:ring-0'
const gridClass = 'grid grid-cols-[150px_1fr] items-center gap-x-4 gap-y-2'
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
const defaultApplicantRelation = 'Named Insured'
const additionalFormProductOptions = [
  'Personal Auto',
  'Homeowners',
  'Renters',
  'Motorcycle / Off-Road',
  'Commercial Auto',
  'General Liability Insurance',
  'Commercial Property Insurance',
  "Workers' Compensation",
  'Professional Liability (Errors & Omissions)',
  'Umbrella Insurance',
  'Travel Insurance',
  'Pet Insurance',
  'Flood or Earthquake Insurance',
  'Health Insurance',
  'Life Insurance',
  'Disability Insurance',
  'Dental & Vision Insurance',
  'Long-Term Care Insurance',
  'Cyber Liability Insurance',
]
const personalAutoLabel = 'Personal Auto'
const driverQuestionLabel = 'Who drives this car the most'
const sectionQuestionProductSlugs = {
  household: 'household-information',
  address: 'address-information',
}
const sectionQuestionProductNames = {
  household: 'Household Information',
  address: 'Address Information',
}
const sectionQuestionProductSlugSet = new Set(Object.values(sectionQuestionProductSlugs))

const baseHouseholdFields = [
  { id: 'ni-first-name', key: 'first-name', label: 'First Name' },
  { id: 'ni-middle-initial', key: 'middle-initial', label: 'Middle Initial' },
  { id: 'ni-last-name', key: 'last-name', label: 'Last Name' },
  { id: 'ni-suffix', key: 'suffix', label: 'Suffix' },
  { id: 'ni-dob', key: 'dob', label: 'Date of Birth', type: 'date' },
  { id: 'ni-gender', key: 'gender', label: 'Gender', options: genderOptions },
  { id: 'ni-marital-status', key: 'marital-status', label: 'Marital Status', options: maritalStatusOptions },
  { id: 'ni-education-level', key: 'education-level', label: 'Education Level', options: educationLevelOptions },
  { id: 'ni-employment', key: 'employment', label: 'Employment', options: employmentOptions },
  { id: 'ni-occupation', key: 'occupation', label: 'Occupation' },
  { id: 'ni-driver-status', key: 'driver-status', label: 'Driver Status', options: driverStatusOptions },
  { id: 'ni-license-type', key: 'license-type', label: "Driver's License Type", options: driversLicenseTypeOptions },
  { id: 'ni-license-status', key: 'license-status', label: 'License Status', options: licenseStatusOptions },
  { id: 'ni-years-licensed', key: 'years-licensed', label: 'Years Licensed', options: yearsLicensedOptions },
  { id: 'ni-license-state', key: 'license-state', label: 'License State', options: licenseStateOptions },
  { id: 'ni-license-number', key: 'license-number', label: 'License Number' },
  { id: 'ni-accident-prevention', key: 'accident-prevention', label: 'Accident Prevention Course', options: yesNoOptions },
  { id: 'ni-sr22', key: 'sr22', label: 'SR-22 Required?', options: yesNoOptions },
  { id: 'ni-fr44', key: 'fr44', label: 'FR-44 Required?', options: yesNoOptions },
]

const baseContactFields = [
  { id: 'phone1', label: 'Phone #1', type: 'tel' },
  { id: 'phone2', label: 'Phone #2', type: 'tel' },
  { id: 'email1', label: 'Email Address #1', type: 'email' },
  { id: 'email2', label: 'Email Address #2', type: 'email' },
]

const baseResidentialFields = [
  { id: 'addressType', label: 'Address Type', type: 'select' },
  { id: 'address1', label: 'Street Address 1' },
  { id: 'address2', label: 'Street Address 2' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
  { id: 'zip', label: 'Zip Code' },
]

const baseMailingFields = [
  { id: 'address1', label: 'Street Address 1' },
  { id: 'address2', label: 'Street Address 2' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
  { id: 'zip', label: 'Zip Code' },
]

const baseAddressTypeOptions = ['Secondary Home', 'Rental Property']

const buildDefaultSchema = () => ({
  sections: {
    household: {
      label: 'Household Information',
      fields: baseHouseholdFields.map((field) => ({
        id: field.key,
        label: field.label,
        type: field.type || 'text',
        visible: true,
      })),
      customFields: [],
    },
    address: {
      label: 'Address Information',
      contactFields: baseContactFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type || 'text',
        visible: true,
      })),
      addressTypes: [...baseAddressTypeOptions],
      residentialFields: baseResidentialFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type || 'text',
        visible: true,
      })),
      mailingFields: baseMailingFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type || 'text',
        visible: true,
      })),
      customFields: [],
    },
    additional: {
      label: 'Additional Information',
      customFields: [],
    },
  },
})

const applySchemaFields = (baseFields, schemaFields = [], getId = (field) => field.id) => {
  const removedIds = new Set(schemaFields.filter((field) => field.removed).map((field) => field.id))
  const schemaMap = new Map(schemaFields.map((field) => [field.id, field]))
  const mapped = baseFields
    .filter((field) => !removedIds.has(getId(field)))
    .map((field) => {
      const schemaField = schemaMap.get(getId(field))
      return {
        ...field,
        label: schemaField?.label || field.label,
        visible: schemaField?.visible !== false,
      }
    })
  if (!schemaFields.length) {
    return mapped.filter((field) => field.visible)
  }
  const ordered = schemaFields
    .filter((field) => !field.removed)
    .map((field) => mapped.find((item) => getId(item) === field.id))
    .filter(Boolean)
  const remaining = mapped.filter((field) => !schemaMap.has(getId(field)))
  return [...ordered, ...remaining].filter((field) => field.visible)
}

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

function MultiSelectDropdown({ id, options, selectedIds, onToggle, placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const safeSelected = Array.isArray(selectedIds) ? selectedIds : []
  const selectedLabels = options.filter((option) => safeSelected.includes(option.id)).map((option) => option.label)
  const isEmpty = !options.length
  const firstSelectedOption = options.find((option) => safeSelected.includes(option.id))
  const firstSelectedLabel = firstSelectedOption?.label || ''
  const firstSelectedName = firstSelectedLabel.split(/\s+/).filter(Boolean)[0] || ''
  const displayValue =
    safeSelected.length > 1
      ? `${firstSelectedName || firstSelectedLabel} ...`
      : firstSelectedName || firstSelectedLabel || placeholder

  useEffect(() => {
    if (!open) return undefined
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        className={`${inputClass} w-full flex items-center justify-between`}
        onClick={() => setOpen((prev) => !prev)}
        disabled={isEmpty}
      >
        <span className={selectedLabels.length ? 'text-slate-900' : 'text-slate-400'}>
          {displayValue}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4 text-slate-500"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && !isEmpty && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={safeSelected.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionAutocomplete({
  value,
  onChange,
  placeholder,
  productId,
  resetKey,
  inputClassName,
  ariaLabel,
  multiline = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [allowSuggestions, setAllowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef(null)
  const lastUserValueRef = useRef('')
  const lastResetKeyRef = useRef(resetKey)

  useEffect(() => {
    if (resetKey === lastResetKeyRef.current) return
    lastResetKeyRef.current = resetKey
    lastUserValueRef.current = ''
    setAllowSuggestions(false)
    setSuggestions([])
    setOpen(false)
  }, [resetKey])

  useEffect(() => {
    if (!allowSuggestions) {
      setSuggestions([])
      setOpen(false)
      return undefined
    }
    const query = (value || '').trim()
    if (query.length < 2) {
      setSuggestions([])
      setOpen(false)
      return undefined
    }
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const productParam = productId ? `&productId=${encodeURIComponent(productId)}` : ''
        const token = getStoredToken()
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(
          `${API_URL}/questions/search?query=${encodeURIComponent(query)}&limit=8${productParam}`,
          { signal: controller.signal, headers, credentials: 'include' }
        )
        if (!res.ok) return
        const data = await res.json()
        const results = Array.isArray(data.results) ? data.results : []
        setSuggestions(results)
        setOpen(isFocused && results.length > 0)
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
  }, [value, productId, allowSuggestions, isFocused])

  useEffect(() => {
    if (allowSuggestions && value !== lastUserValueRef.current) {
      setAllowSuggestions(false)
      setSuggestions([])
      setOpen(false)
    }
  }, [value, allowSuggestions])

  useEffect(() => {
    if (!multiline) return
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [value, multiline])

  const handleSelect = (text) => {
    lastUserValueRef.current = text
    setAllowSuggestions(false)
    onChange(text)
    setOpen(false)
  }

  const handleChange = (event) => {
    const nextValue = event.target.value
    lastUserValueRef.current = nextValue
    setAllowSuggestions(true)
    onChange(nextValue)
  }

  const InputTag = multiline ? 'textarea' : 'input'

  return (
    <div className="relative">
      <InputTag
        ref={inputRef}
        rows={multiline ? 2 : undefined}
        className={`${inputClassName || inputClass} w-full${multiline ? ' h-auto resize-none leading-5 py-1 overflow-hidden' : ''}`}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          setIsFocused(true)
          if (allowSuggestions && suggestions.length) setOpen(true)
        }}
        onBlur={() => {
          setIsFocused(false)
          setAllowSuggestions(false)
          setOpen(false)
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.source || 'SYSTEM'}-${suggestion.id ?? suggestion.text}`}
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

const hasNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some(hasNonEmptyValue)
  if (typeof value === 'object') return Object.values(value).some(hasNonEmptyValue)
  return true
}

const normalizeQuestionText = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const hasNamedInsuredData = (person) =>
  Object.entries(person || {}).some(([key, value]) => key !== 'relation' && hasNonEmptyValue(value))

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

export default function CreateProfile({
  onShareSnapshotChange,
  onFormDataChange,
  onSectionSave,
  initialData,
  allowedSections,
  startSection,
  startKey = 0,
  showProgress = false,
}) {
  const { user } = useAuth()
  const [formSchema, setFormSchema] = useState(() => buildDefaultSchema())
  const [products, setProducts] = useState([])
  const [sectionBankQuestions, setSectionBankQuestions] = useState({ household: [], address: [] })
  const createContact = () => ({ phone1: '', phone2: '', email1: '', email2: '' })
  const createHouseholdMember = () => ({ relation: '', employment: '', occupation: '' })
  const createAddressEntry = () => ({
    addressType: '',
    contact: createContact(),
    residential: { addressType: '', address1: '', address2: '', city: '', state: '', zip: '', residents: [] },
    mailing: { address1: '', address2: '', city: '', state: '', zip: '' },
  })
  const createAdditionalQuestion = () => ({ question: '', input: '' })
  const [activeSection, setActiveSection] = useState(null)
  const [householdComplete, setHouseholdComplete] = useState(false)
  const [householdErrors, setHouseholdErrors] = useState({})
  const [householdSaving, setHouseholdSaving] = useState(false)
  const [addressComplete, setAddressComplete] = useState(false)
  const [addressErrors, setAddressErrors] = useState({})
  const [addressSaving, setAddressSaving] = useState(false)
  const [additionalComplete, setAdditionalComplete] = useState(false)
  const [additionalErrors, setAdditionalErrors] = useState({})
  const [additionalSaving, setAdditionalSaving] = useState(false)
  const [additionalSummarySaving, setAdditionalSummarySaving] = useState(false)
  const [householdEditing, setHouseholdEditing] = useState(false)
  const [addressEditing, setAddressEditing] = useState(false)
  const [additionalEditing, setAdditionalEditing] = useState(false)
  const [activeHouseholdIndex, setActiveHouseholdIndex] = useState('primary')
  const [activeAddressIndex, setActiveAddressIndex] = useState('primary')
  const [namedInsured, setNamedInsured] = useState({
    relation: defaultApplicantRelation,
    employment: '',
    occupation: '',
  })
  const [additionalHouseholds, setAdditionalHouseholds] = useState([])
  const [newHousehold, setNewHousehold] = useState(createHouseholdMember())
  const [showAddHouseholdModal, setShowAddHouseholdModal] = useState(false)
  const [contacts, setContacts] = useState([createContact()])
  const [residential, setResidential] = useState({
    addressType: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    residents: [],
  })
  const [mailing, setMailing] = useState({ address1: '', address2: '', city: '', state: '', zip: '' })
  const [additionalAddresses, setAdditionalAddresses] = useState([])
  const [newAddress, setNewAddress] = useState(createAddressEntry())
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [additionalForms, setAdditionalForms] = useState([])
  const [activeAdditionalFormIndex, setActiveAdditionalFormIndex] = useState(null)
  const [additionalFormName, setAdditionalFormName] = useState('')
  const [additionalFormProductId, setAdditionalFormProductId] = useState('')
  const [additionalFormMode, setAdditionalFormMode] = useState('')
  const [additionalQuestions, setAdditionalQuestions] = useState([])
  const [baseAdditionalQuestionKeys, setBaseAdditionalQuestionKeys] = useState([])
  const [additionalFormError, setAdditionalFormError] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState({
    household: {},
    address: {},
    additional: {},
  })
  const [hydrated, setHydrated] = useState(false)
  const prefillKeyRef = useRef('')
  const formsPayloadRef = useRef(null)
  const lastSavedSerializedRef = useRef(null)
  const notificationTimerRef = useRef(null)
  const [notification, setNotification] = useState(null)
  const baseAdditionalQuestionKeysRef = useRef([])
  const sectionProductIdsRef = useRef({ household: '', address: '' })
  const suppressProductSyncRef = useRef(false)
  const suppressModeResetRef = useRef(false)
  const initialDataRef = useRef(false)
  const hasHouseholdData =
    hasNamedInsuredData(namedInsured) || additionalHouseholds.some((person) => hasNonEmptyValue(person))
  const hasAddressData = hasNonEmptyValue({
    contacts,
    residential,
    mailing,
    additionalAddresses,
  })
  const hasAdditionalData = additionalForms.length > 0
  const driverQuestionKey = driverQuestionLabel.toLowerCase()
  const normalizeQuestionLabel = (value = '') => value.toString().trim().toLowerCase()
  const isDriverQuestion = (value = '') => normalizeQuestionLabel(value) === driverQuestionKey
  const resolveAdditionalProductName = (value) => {
    if (!value) return ''
    const match = additionalFormProducts.find((product) => String(product.id) === String(value))
    if (match?.name) return match.name
    if (additionalFormProductOptions.includes(value)) return value
    return ''
  }

  const additionalFormProducts = useMemo(
    () => products.filter((product) => !sectionQuestionProductSlugSet.has(product.slug)),
    [products]
  )

  const resolveSectionProductId = (sectionKey) => {
    const slug = sectionQuestionProductSlugs[sectionKey]
    const name = sectionQuestionProductNames[sectionKey]
    if (!slug && !name) return ''
    const match = products.find(
      (product) => product.slug === slug || product.name === name
    )
    return match ? String(match.id) : ''
  }

  const loadSectionQuestions = async (sectionKey, productId) => {
    if (!productId) return
    try {
      const token = getStoredToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/questions/product?productId=${encodeURIComponent(productId)}`, {
        headers,
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json()
      const bankQuestions = Array.isArray(data.questions) ? data.questions : []
      const systemOnly = bankQuestions.filter((question) => question?.source === 'SYSTEM' || !question?.source)
      const normalized = systemOnly
        .map((question) => ({
          text: question?.text || '',
          key: normalizeQuestionText(question?.text || ''),
        }))
        .filter((entry) => entry.key)
      setSectionBankQuestions((prev) => ({
        ...prev,
        [sectionKey]: normalized,
      }))
    } catch (error) {
      console.warn(`Failed to load ${sectionKey} question bank`, error)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const loadSchema = async () => {
      try {
        const res = await fetch(`${API_URL}/form-schema/create-profile`, {
          signal: controller.signal,
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        if (data?.schema?.schema) {
          setFormSchema(data.schema.schema)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setFormSchema(buildDefaultSchema())
        }
      }
    }
    loadSchema()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/products`, { signal: controller.signal, credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const items = Array.isArray(data.products) ? data.products : []
        setProducts(items)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setProducts([])
        }
      }
    }
    loadProducts()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!products.length) return
    const householdId = resolveSectionProductId('household')
    const addressId = resolveSectionProductId('address')
    if (householdId && sectionProductIdsRef.current.household !== householdId) {
      sectionProductIdsRef.current.household = householdId
      loadSectionQuestions('household', householdId)
    }
    if (addressId && sectionProductIdsRef.current.address !== addressId) {
      sectionProductIdsRef.current.address = addressId
      loadSectionQuestions('address', addressId)
    }
  }, [products])

  useEffect(() => {
    baseAdditionalQuestionKeysRef.current = baseAdditionalQuestionKeys
  }, [baseAdditionalQuestionKeys])

  useEffect(() => {
    if (additionalFormMode !== 'existing') return
    const productName = resolveAdditionalProductName(additionalFormProductId)
    if (productName.toLowerCase() !== personalAutoLabel.toLowerCase()) return
    setAdditionalQuestions((prev) => {
      const existingIndex = prev.findIndex((question) => isDriverQuestion(question?.question))
      const existing = existingIndex >= 0 ? prev[existingIndex] : null
      const normalizedInput = Array.isArray(existing?.input) ? existing.input : []
      const nextBase = { question: driverQuestionLabel, input: normalizedInput }
      if (existingIndex === 0 && prev[0]?.question === driverQuestionLabel) {
        return prev
      }
      const remaining = prev.filter((question) => !isDriverQuestion(question?.question))
      return [nextBase, ...remaining]
    })
    setBaseAdditionalQuestionKeys((prev) => {
      const driverKey = normalizeQuestionText(driverQuestionLabel)
      const current = Array.isArray(prev) && prev.length ? prev : baseAdditionalQuestionKeysRef.current || []
      const nextSet = new Set(current)
      nextSet.add(driverKey)
      const next = Array.from(nextSet)
      if (next.length === (current || []).length && next.every((key) => (current || []).includes(key))) {
        return prev
      }
      return next
    })
  }, [additionalFormMode, additionalFormProductId, products])

  useEffect(() => {
    if (!initialData || initialDataRef.current) return
    const household = initialData.household || {}
    const address = initialData.address || {}
    const additional = initialData.additional || {}
    const customFields = initialData.customFields || {}
    setNamedInsured((prev) => ({
      ...prev,
      ...(household.namedInsured || {}),
      relation: household.namedInsured?.relation || prev.relation || defaultApplicantRelation,
    }))
    setAdditionalHouseholds(Array.isArray(household.additionalHouseholds) ? household.additionalHouseholds : [])
    setContacts(Array.isArray(address.contacts) && address.contacts.length ? address.contacts : [createContact()])
    setResidential(address.residential || { address1: '', city: '', state: '', zip: '' })
    setMailing(address.mailing || { address1: '', city: '', state: '', zip: '' })
    setAdditionalAddresses(Array.isArray(address.additionalAddresses) ? address.additionalAddresses : [])
    setAdditionalForms(Array.isArray(additional.additionalForms) ? additional.additionalForms : [])
    setCustomFieldValues({
      household: customFields.household || {},
      address: customFields.address || {},
      additional: customFields.additional || {},
    })
    initialDataRef.current = true
    setHydrated(true)
  }, [initialData])

  useEffect(() => {
    if (!initialData) setHydrated(true)
  }, [initialData])

  useEffect(() => {
    if (initialDataRef.current) return
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

  useEffect(() => {
    if (hasHouseholdData && !householdComplete) setHouseholdComplete(true)
    if (hasAddressData && !addressComplete) setAddressComplete(true)
    if (hasAdditionalData && !additionalComplete) setAdditionalComplete(true)
  }, [
    hasHouseholdData,
    hasAddressData,
    hasAdditionalData,
    householdComplete,
    addressComplete,
    additionalComplete,
  ])

  const specialEmploymentOccupations = {
    'Student (full-time)': ['Student (full-time)'],
    'Retired (full-time)': ['Retired (full-time)'],
    'Homemaker (full-time)': ['Homemaker (full-time)'],
    'Unemployed': ['Unemployed'],
  }
  const schema = formSchema || buildDefaultSchema()
  const householdSchemaFields = schema.sections?.household?.fields || []
  const residentialSchemaFields = schema.sections?.address?.residentialFields || []

  const householdFields = applySchemaFields(baseHouseholdFields, householdSchemaFields, (field) => field.key)
  const residentialFields = applySchemaFields(baseResidentialFields, residentialSchemaFields)
  const orderedResidentialFields = (() => {
    const fields = [...residentialFields]
    const ordered = []
    const preferredOrder = ['addressType', 'address1', 'address2']
    const used = new Set()
    preferredOrder.forEach((fieldId) => {
      const match = fields.find((field) => field.id === fieldId)
      if (match) {
        ordered.push(match)
        used.add(fieldId)
      }
    })
    fields.forEach((field) => {
      if (!used.has(field.id)) ordered.push(field)
    })
    return ordered
  })()
  const rawAddressTypeOptions = Array.isArray(schema.sections?.address?.addressTypes)
    ? schema.sections.address.addressTypes
    : baseAddressTypeOptions
  const addressTypeOptions = rawAddressTypeOptions
    .map((option) => option?.toString().trim())
    .filter(Boolean)
  const householdSectionLabel = schema.sections?.household?.label || 'Household Information'
  const addressSectionLabel = schema.sections?.address?.label || 'Address Information'
  const additionalSectionLabel = schema.sections?.additional?.label || 'Additional Information'
  const householdSectionName = 'Household Information'
  const addressSectionName = 'Address Information'
  const additionalSectionName = 'Additional Information'

  const validateHousehold = () => {
    return {}
  }

  const validateAddress = () => {
    return {}
  }

  const validateAdditional = () => {
    return {}
  }

  const handleHouseholdSaveContinue = async () => {
    if (householdSaving) return
    setHouseholdSaving(true)
    const wasComplete = householdComplete
    const errors = validateHousehold()
    setHouseholdErrors(errors)
    if (Object.keys(errors).length > 0) {
      setHouseholdSaving(false)
      return
    }
    let saveResult = { success: true }
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = formsPayloadRef.current || buildFormsPayload()
        saveResult = await onSectionSave({
          section: householdSectionName,
          nextSection: addressSectionName,
          forms: formsPayload,
        })
      }
    } catch (error) {
      saveResult = { success: false }
    }
    if (!saveResult?.success) {
      setHouseholdSaving(false)
      return
    }
    if (formsPayloadRef.current) {
      notifySaveIfChanged(formsPayloadRef.current)
    }
    setHouseholdComplete(true)
    setHouseholdEditing(false)
    if (!wasComplete) {
      openSection('address')
      setAddressEditing(true)
    }
    setHouseholdSaving(false)
  }

  const handleAddressSaveContinue = async () => {
    if (addressSaving) return
    setAddressSaving(true)
    const errors = validateAddress()
    setAddressErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAddressSaving(false)
      return
    }
    let saveResult = { success: true }
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = formsPayloadRef.current || buildFormsPayload()
        saveResult = await onSectionSave({
          section: addressSectionName,
          nextSection: additionalSectionName,
          forms: formsPayload,
        })
      }
    } catch (error) {
      saveResult = { success: false }
    }
    if (!saveResult?.success) {
      setAddressSaving(false)
      return
    }
    if (formsPayloadRef.current) {
      notifySaveIfChanged(formsPayloadRef.current)
    }
    setAddressComplete(true)
    setAddressEditing(false)
    setAddressSaving(false)
  }

  const handleAdditionalSaveContinue = async (formsOverride, options = {}) => {
    if (additionalSaving && !options.skipSaving) return
    if (!options.skipSaving) {
      setAdditionalSaving(true)
    }
    const errors = validateAdditional()
    setAdditionalErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAdditionalSaving(false)
      return
    }
    let saveResult = { success: true }
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = formsOverride || formsPayloadRef.current || buildFormsPayload()
        saveResult = await onSectionSave({
          section: additionalSectionName,
          nextSection: additionalSectionName,
          forms: formsPayload,
        })
      }
    } catch (error) {
      saveResult = { success: false }
    }
    if (!saveResult?.success) {
      setAdditionalSaving(false)
      return
    }
    const payloadForNotification = formsOverride || formsPayloadRef.current
    if (payloadForNotification) {
      notifySaveIfChanged(payloadForNotification)
    }
    setAdditionalComplete(true)
    setAdditionalEditing(false)
    setAdditionalSaving(false)
  }

  const handleAdditionalSummaryContinue = async () => {
    if (additionalSummarySaving) return
    setAdditionalSummarySaving(true)
    let saveResult = { success: true }
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = formsPayloadRef.current || buildFormsPayload()
        saveResult = await onSectionSave({
          section: additionalSectionName,
          nextSection: 'Summary',
          forms: formsPayload,
          profileStatus: 'completed',
          logClick: false,
        })
      }
    } catch (error) {
      saveResult = { success: false }
    }
    if (!saveResult?.success) {
      setAdditionalSummarySaving(false)
      return
    }
    openSection('summary')
    setAdditionalSummarySaving(false)
  }

  const customFieldsForSection = (sectionKey) =>
    (schema.sections?.[sectionKey]?.customFields || []).filter(
      (field) => field.visible !== false && field.removed !== true
    )

  const setCustomFieldValue = (sectionKey, fieldId, value) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [fieldId]: value,
      },
    }))
  }

  const buildCustomFieldRows = (sectionKey, idPrefix) =>
    customFieldsForSection(sectionKey).map((field) => ({
      id: `${idPrefix}-${field.id}`,
      label: field.label || field.id,
      type: field.type || 'text',
      value: customFieldValues?.[sectionKey]?.[field.id] ?? '',
      onChange: (event) => setCustomFieldValue(sectionKey, field.id, event.target.value),
    }))

  const buildQuestionBankRows = (sectionKey, idPrefix, questions = [], excludeKeys = new Set()) =>
    questions
      .map((question, index) => {
        const text = question?.text || ''
        const normalized = normalizeQuestionText(text)
        const key = `qb-${normalized}`
        if (!text || key === 'qb-' || excludeKeys.has(normalized)) return null
        return {
          id: `${idPrefix}-${index}`,
          label: text,
          type: 'text',
          value: customFieldValues?.[sectionKey]?.[key] ?? '',
          onChange: (event) => setCustomFieldValue(sectionKey, key, event.target.value),
        }
      })
      .filter(Boolean)
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

    return householdFields.map((field) => {
      const fieldKey = field.key
      const fieldId = `${idPrefix}-${fieldKey}`
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

  const updateAdditionalAddress = (index, updater) => {
    setAdditionalAddresses((prev) => {
      const next = [...prev]
      const current = next[index] ?? createAddressEntry()
      const nextEntry = typeof updater === 'function' ? updater(current) : updater
      next[index] = nextEntry
      return next
    })
  }

  const removeAdditionalHousehold = (index) => {
    setAdditionalHouseholds((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalAddress = (index) => {
    setAdditionalAddresses((prev) => prev.filter((_, idx) => idx !== index))
  }

  const removeAdditionalForm = (index) => {
    const removedForm = additionalForms[index]
    setAdditionalForms((prev) => prev.filter((_, idx) => idx !== index))
    showNotification('Additional form removed.')
    const formName = removedForm?.name || removedForm?.productName || ''
    if (user?.customerId) {
      const token = getStoredToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      fetch(`${API_URL}/customers/${user.customerId}/forms/additional/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        credentials: 'include',
        body: JSON.stringify({ formName, index }),
      }).catch((error) => {
        console.warn('Failed to log additional form removal', error)
      })
    }
  }

  const addAdditionalQuestion = () => {
    setAdditionalQuestions((prev) => [...prev, createAdditionalQuestion()])
  }

  const removeAdditionalQuestion = () => {
    setAdditionalQuestions((prev) => {
      if (prev.length <= baseAdditionalQuestionKeysRef.current.length) return prev
      return prev.slice(0, -1)
    })
  }

  const updateAdditionalQuestion = (index, field, value) => {
    setAdditionalQuestions((prev) => {
      const next = [...prev]
      const current = next[index] ?? createAdditionalQuestion()
      next[index] = { ...current, [field]: value }
      return next
    })
  }

  const saveCustomerQuestions = async (questions, productId, formName) => {
    const cleaned = questions
      .map((question) => (question || '').toString().trim())
      .filter(Boolean)
    if (!cleaned.length) return
    try {
      const token = getStoredToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await fetch(`${API_URL}/questions/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        credentials: 'include',
        body: JSON.stringify({ questions: cleaned, ...(productId ? { productId } : {}), formName: formName || '' }),
      })
    } catch (error) {
      console.warn('Failed to save customer questions', error)
    }
  }

  const editAdditionalForm = (index) => {
    const form = additionalForms[index] ?? { name: '', questions: [], productId: null }
    const fallbackProduct =
      additionalFormProducts.find(
        (product) => product.name === form.productName || product.name === form.name
      ) || null
    const resolvedProductId = form.productId || fallbackProduct?.id || ''
    setActiveAdditionalFormIndex(index)
    if (resolvedProductId) {
      suppressModeResetRef.current = true
      suppressProductSyncRef.current = true
      setAdditionalFormMode('existing')
      setAdditionalFormProductId(String(resolvedProductId))
      setAdditionalFormName('')
    } else {
      suppressModeResetRef.current = true
      suppressProductSyncRef.current = true
      setAdditionalFormMode('custom')
      setAdditionalFormProductId('')
      setAdditionalFormName(form.name ?? '')
    }
    setAdditionalQuestions(form.questions ?? [])
    setBaseAdditionalQuestionKeys([])
    setAdditionalFormError('')
    setAdditionalEditing(true)
  }

  const startNewAdditionalForm = () => {
    setActiveAdditionalFormIndex(null)
    setAdditionalFormMode('')
    setAdditionalFormName('')
    setAdditionalFormProductId('')
    setAdditionalQuestions([])
    setBaseAdditionalQuestionKeys([])
    setAdditionalFormError('')
    setAdditionalEditing(true)
  }

  const isSectionAllowed = useCallback((section) => {
    if (!allowedSections) return true
    if (allowedSections[section] === undefined) return true
    return Boolean(allowedSections[section])
  }, [allowedSections])

  const sectionHistoryRef = useRef(null)

  const pushSectionHistory = useCallback((section) => {
    if (typeof window === 'undefined') return
    const currentSection = window.history.state?.clientFormSection
    if (!sectionHistoryRef.current && !currentSection) {
      window.history.replaceState({ clientFormSection: section }, '')
      sectionHistoryRef.current = section
      return
    }
    if (sectionHistoryRef.current === section) return
    window.history.pushState({ clientFormSection: section }, '')
    sectionHistoryRef.current = section
  }, [])

  const syncProductQuestions = async (productId) => {
    if (!productId) {
      setAdditionalQuestions([])
      setBaseAdditionalQuestionKeys([])
      return
    }
    setAdditionalQuestions([])
    setBaseAdditionalQuestionKeys([])
    try {
      const token = getStoredToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/questions/product?productId=${encodeURIComponent(productId)}`, {
        headers,
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json()
      const bankQuestions = Array.isArray(data.questions) ? data.questions : []
      const baseList = bankQuestions
        .map((question) => ({
          text: question?.text || '',
          key: normalizeQuestionText(question?.text || ''),
        }))
        .filter((entry) => entry.key)
      setAdditionalQuestions(baseList.map((entry) => ({ question: entry.text, input: '' })))
      setBaseAdditionalQuestionKeys(baseList.map((entry) => entry.key))
    } catch (error) {
      console.warn('Failed to load product questions', error)
    }
  }

  const openSection = useCallback(
    (section, options = {}) => {
      if (!isSectionAllowed(section)) return
      const { pushHistory = true } = options
      setActiveSection(section)
      setShowAddHouseholdModal(false)
      setShowAddAddressModal(false)
      setHouseholdEditing(false)
      setAddressEditing(false)
      if (section === 'household') {
        setActiveHouseholdIndex('primary')
        setHouseholdEditing(!hasHouseholdData)
      }
      if (section === 'address') {
        setActiveAddressIndex('primary')
        setAddressEditing(!hasAddressData)
      }
      if (section === 'additional') {
        setAdditionalEditing(!hasAdditionalData)
      }
      if (pushHistory) {
        pushSectionHistory(section)
      }
      sectionHistoryRef.current = section
    },
    [hasHouseholdData, hasAddressData, hasAdditionalData, isSectionAllowed, pushSectionHistory]
  )

  const startKeyRef = useRef(null)

  useEffect(() => {
    if (!startSection) return
    if (startKeyRef.current === startKey) return
    startKeyRef.current = startKey
    openSection(startSection)
  }, [startSection, startKey, openSection])

  useEffect(() => {
    const handlePopState = (event) => {
      const section = event.state?.clientFormSection
      if (!section) return
      openSection(section, { pushHistory: false })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [openSection])

  useEffect(() => {
    if (!additionalEditing) return
    if (suppressProductSyncRef.current) {
      suppressProductSyncRef.current = false
      return
    }
    syncProductQuestions(additionalFormProductId)
  }, [additionalEditing, additionalFormProductId])

  useEffect(() => {
    if (additionalFormError && additionalFormName.trim()) {
      setAdditionalFormError('')
    }
  }, [additionalFormName, additionalFormError])

  useEffect(() => {
    if (suppressModeResetRef.current) {
      suppressModeResetRef.current = false
      return
    }
    setAdditionalFormProductId('')
    setAdditionalFormName('')
    setAdditionalQuestions([])
    setBaseAdditionalQuestionKeys([])
    setAdditionalFormError('')
  }, [additionalFormMode])

  const buildFullName = (person) => {
    const nameParts = [person['first-name'], person['middle-initial'], person['last-name']].filter(Boolean)
    const baseName = nameParts.join(' ')
    if (!person.suffix) {
      return baseName
    }
    return baseName ? `${baseName}, ${person.suffix}` : person.suffix
  }
  const namedInsuredLabel = namedInsured.relation ? namedInsured.relation : 'Primary Applicant'
  const getAdditionalHouseholdLabel = (relation) => (relation ? relation : 'Additional Household Member')
  const getHouseholdOptionLabel = (person, fallbackLabel) => {
    const name = buildFullName(person || {})
    if (name) return name
    if (fallbackLabel) return fallbackLabel
    return 'Household member'
  }
  const householdMemberOptions = [
    {
      id: 'primary',
      label: getHouseholdOptionLabel(namedInsured, namedInsuredLabel || 'Primary Applicant'),
    },
    ...additionalHouseholds
      .map((person, index) => ({ person, index }))
      .filter(({ person }) => hasNonEmptyValue(person))
      .map(({ person, index }) => ({
        id: `additional-${index}`,
        label: getHouseholdOptionLabel(person, getAdditionalHouseholdLabel(person?.relation)),
      })),
  ]
  const residentLabelMap = new Map(householdMemberOptions.map((option) => [option.id, option.label]))
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
  const householdCustomFields = buildCustomFieldRows('household', `${activeHousehold.idPrefix}-custom`)
  const householdLabelExclusions = (() => {
    const keys = new Set()
    keys.add(normalizeQuestionText('Relation To Applicant'))
    activeHouseholdFields.forEach((field) => {
      if (field?.label) keys.add(normalizeQuestionText(field.label))
    })
    householdCustomFields.forEach((field) => {
      if (field?.label) keys.add(normalizeQuestionText(field.label))
    })
    return keys
  })()
  const householdBankFields =
    activeHouseholdIndex === 'primary'
      ? buildQuestionBankRows(
          'household',
          `${activeHousehold.idPrefix}-bank`,
          sectionBankQuestions.household,
          householdLabelExclusions
        )
      : []
  const activeHouseholdFieldRows = [...activeHouseholdFields, ...householdCustomFields, ...householdBankFields]
  const primaryContact = contacts[0] || createContact()
  const primaryAddressLabel = 'Primary Address'
  const getAdditionalAddressLabel = (entry, index) => {
    const rawType = entry?.addressType || entry?.residential?.addressType || ''
    const type = rawType ? rawType.trim() : ''
    return type || `Additional Address ${index + 1}`
  }
  const activeAdditionalAddressIndex = typeof activeAddressIndex === 'number' ? activeAddressIndex : null
  const activeAdditionalAddress =
    activeAdditionalAddressIndex !== null ? additionalAddresses[activeAdditionalAddressIndex] : null
  const activeAddressEntry = activeAdditionalAddress ?? createAddressEntry()
  const activeAddressLabel =
    activeAdditionalAddressIndex === null
      ? primaryAddressLabel
      : getAdditionalAddressLabel(activeAdditionalAddress, activeAdditionalAddressIndex)
  const activeAddressResidential =
    activeAdditionalAddressIndex === null ? residential : activeAddressEntry.residential
  const activeAddressType =
    activeAdditionalAddressIndex === null
      ? residential?.addressType ?? ''
      : activeAddressEntry.residential?.addressType ?? activeAddressEntry.addressType ?? ''
  const activeAddressResidents = Array.isArray(activeAddressResidential?.residents)
    ? activeAddressResidential.residents
    : []
  const newAddressResidents = Array.isArray(newAddress.residential?.residents) ? newAddress.residential.residents : []
  const addressCustomFields = buildCustomFieldRows(
    'address',
    `addr-${activeAdditionalAddressIndex === null ? 'primary' : activeAdditionalAddressIndex}-custom`
  )
  const addressQuestionRows = (() => {
    if (activeAddressIndex !== 'primary') return []
    const rows = []
    const seen = new Set()
    const residentKey = normalizeQuestionText('Who lives in this address')
    const fieldMap = new Map([
      [normalizeQuestionText('Address Type'), { id: 'addressType', type: 'select' }],
      [normalizeQuestionText('Street Address'), { id: 'address1', type: 'text' }],
      [normalizeQuestionText('Street Address 1'), { id: 'address1', type: 'text' }],
      [normalizeQuestionText('Street Address 2'), { id: 'address2', type: 'text' }],
      [normalizeQuestionText('City'), { id: 'city', type: 'text' }],
      [normalizeQuestionText('State'), { id: 'state', type: 'text' }],
      [normalizeQuestionText('Zip Code'), { id: 'zip', type: 'text' }],
      [normalizeQuestionText('Zip'), { id: 'zip', type: 'text' }],
    ])

    sectionBankQuestions.address.forEach((question, index) => {
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (normalized === residentKey) {
        rows.push({
          type: 'residents',
          id: `addr-bank-residents-${index}`,
          label,
        })
        return
      }

      const mapped = fieldMap.get(normalized)
      if (mapped) {
        rows.push({
          type: 'field',
          id: `addr-bank-${mapped.id}-${index}`,
          label,
          fieldId: mapped.id,
          fieldType: mapped.type,
        })
        return
      }

      rows.push({
        type: 'custom',
        id: `addr-bank-custom-${index}`,
        label,
        customKey: `qb-${normalized}`,
      })
    })

    if (!rows.length) {
      orderedResidentialFields.forEach((field, index) => {
        rows.push({
          type: 'field',
          id: `addr-fallback-${field.id}-${index}`,
          label: field.label,
          fieldId: field.id,
          fieldType: field.type || 'text',
        })
      })
      rows.push({
        type: 'residents',
        id: 'addr-fallback-residents',
        label: 'Who lives in this address',
      })
    }

    addressCustomFields.forEach((field) => {
      rows.push({
        type: 'customField',
        id: field.id,
        label: field.label,
        customField: field,
      })
    })

    return rows
  })()
  const showHouseholdSection = activeSection === 'household' && isSectionAllowed('household')
  const showAddressSection = activeSection === 'address' && isSectionAllowed('address')
  const showHouseholdForm =
    showHouseholdSection && (!hasHouseholdData || householdEditing) && !showAddHouseholdModal
  const showHouseholdSummary =
    showHouseholdSection && hasHouseholdData && !householdEditing && !showAddHouseholdModal
  const showAddressForm = showAddressSection && (!hasAddressData || addressEditing) && !showAddAddressModal
  const showAddressSummary = showAddressSection && hasAddressData && !addressEditing && !showAddAddressModal
  const showAdditionalSection = activeSection === 'additional' && isSectionAllowed('additional')
  const showSummarySection = activeSection === 'summary' && isSectionAllowed('summary')
  const showAdditionalForm = showAdditionalSection && (!hasAdditionalData || additionalEditing)
  const showAdditionalSummary = showAdditionalSection && hasAdditionalData && !additionalEditing
  const progressSteps = [
    { id: 'household', label: householdSectionLabel, complete: householdComplete, allowed: isSectionAllowed('household') },
    { id: 'address', label: addressSectionLabel, complete: addressComplete, allowed: isSectionAllowed('address') },
    { id: 'additional', label: additionalSectionLabel, complete: additionalComplete, allowed: isSectionAllowed('additional') },
  ].filter((step) => step.allowed)
  const progressCompletedCount = progressSteps.filter((step) => step.complete).length
  const progressTotal = progressSteps.length
  const progressPercent = progressTotal ? Math.round((progressCompletedCount / progressTotal) * 100) : 0
  const progressSummary = progressTotal ? `${progressCompletedCount} of ${progressTotal} sections` : 'No sections available'
  const setActiveAddressType = (value) => {
    if (activeAddressIndex === 'primary') {
      setResidential((prev) => ({ ...prev, addressType: value }))
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      addressType: value,
      residential: { ...(prev.residential ?? {}), addressType: value },
    }))
  }
  const toggleResidentSelection = (current, id) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  const toggleAdditionalQuestionResident = (index, id) => {
    setAdditionalQuestions((prev) => {
      const next = [...prev]
      const current = next[index] ?? createAdditionalQuestion()
      const currentIds = Array.isArray(current.input) ? current.input : []
      const nextIds = toggleResidentSelection(currentIds, id)
      next[index] = { ...current, input: nextIds }
      return next
    })
  }
  const setActiveAddressResidents = (nextResidents) => {
    if (activeAddressIndex === 'primary') {
      setResidential((prev) => ({ ...prev, residents: nextResidents }))
      return
    }
    if (typeof activeAddressIndex !== 'number') {
      return
    }
    updateAdditionalAddress(activeAddressIndex, (prev) => ({
      ...prev,
      residential: { ...(prev.residential ?? {}), residents: nextResidents },
    }))
  }
  const toggleActiveAddressResident = (id) =>
    setActiveAddressResidents(toggleResidentSelection(activeAddressResidents, id))
  const setNewAddressResidents = (nextResidents) =>
    setNewAddress((prev) => ({
      ...prev,
      residential: { ...(prev.residential ?? {}), residents: nextResidents },
    }))
  const toggleNewAddressResident = (id) =>
    setNewAddressResidents(toggleResidentSelection(newAddressResidents, id))
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
      residential: {
        ...(prev.residential ?? {
          addressType: '',
          address1: '',
          address2: '',
          city: '',
          state: '',
          zip: '',
          residents: [],
        }),
        [field]: value,
      },
    }))
  }
  const nameFieldKeys = new Set(['first-name', 'middle-initial', 'last-name', 'suffix'])
  const buildHouseholdDetails = (person) => {
    const details = []
    if (hasNonEmptyValue(person?.relation)) {
      details.push({ label: 'Relation to Applicant', value: person.relation })
    }
    householdFields.forEach((field) => {
      const fieldKey = field.key
      if (nameFieldKeys.has(fieldKey)) return
      const value = person?.[fieldKey]
      if (hasNonEmptyValue(value)) {
        const label =
          field.id === 'address1' ? field.label.replace(/Street Address 1/i, 'Street Address') : field.label
        details.push({ label, value })
      }
    })
    return details
  }
  const buildHouseholdSummaryRows = (fullName) =>
    fullName ? [{ label: 'Full Name', value: fullName }] : []
  const buildAddressDetails = (residentialEntry) => {
    const details = []
    residentialFields.forEach((field) => {
      if (field.id === 'addressType' || field.id === 'address2') return
      const value = residentialEntry?.[field.id]
      if (hasNonEmptyValue(value)) {
        details.push({ label: field.label, value })
      }
    })
    return details
  }
  const primaryFullName = buildFullName(namedInsured)
  const summaryValue = (value) => (value ? value : '-')
  const householdFieldKeySet = new Set(householdFields.map((field) => field.key))
  const hasNameFieldsInSchema = householdFields.some((field) => nameFieldKeys.has(field.key))
  const primarySummaryRows = [
    { label: 'Full Name', value: primaryFullName },
    { label: 'Phone', value: primaryContact?.phone1 || '' },
    { label: 'Email', value: primaryContact?.email1 || '' },
  ]
  const getFirstName = (value) => {
    const trimmed = (value || '').toString().trim()
    if (!trimmed) return ''
    return trimmed.split(/\s+/)[0]
  }
  const formatResidentSummary = (residentIds = []) => {
    if (!Array.isArray(residentIds) || residentIds.length === 0) return '-'
    const primarySelected = residentIds.includes('primary')
    const primaryName = buildFullName(namedInsured)
    const fallbackLabel = residentLabelMap.get(residentIds[0]) || ''
    const baseLabel = primarySelected ? primaryName : fallbackLabel
    const firstName = getFirstName(baseLabel) || baseLabel
    if (!firstName) return '-'
    return residentIds.length > 1 ? `${firstName} ...` : firstName
  }
  const formatDriverSelection = (value) => {
    if (!Array.isArray(value)) {
      return typeof value === 'string' && value.trim() ? value : '-'
    }
    const labels = value.map((id) => residentLabelMap.get(id) || id).filter(Boolean)
    if (!labels.length) return '-'
    const firstLabel = labels[0] || ''
    const firstName = getFirstName(firstLabel) || firstLabel
    return labels.length > 1 ? `${firstName} ...` : firstName
  }
  const formatAdditionalQuestionInput = (question) => {
    if (!question) return '-'
    if (isDriverQuestion(question.question)) {
      return formatDriverSelection(question.input)
    }
    return summaryValue(question.input)
  }

  const buildFormsPayload = useCallback((overrides = {}) => {
    const nextAdditionalForms = overrides.additionalForms ?? additionalForms
    const availableProducts = additionalFormProducts.length
      ? additionalFormProducts
      : additionalFormProductOptions.map((name) => ({ id: name, name }))
    const parseProductId = (value) => {
      if (!value) return null
      const parsed = Number(value)
      return Number.isNaN(parsed) ? null : parsed
    }
    return {
      household: {
        namedInsured,
        additionalHouseholds,
      },
      address: {
        contacts,
        residential,
        mailing,
        additionalAddresses,
      },
      additional: {
        additionalForms: nextAdditionalForms.map((form) => {
          const productId = parseProductId(form.productId)
          const productName = availableProducts.find((product) => String(product.id) === String(productId))?.name
          return {
            ...form,
            productId: productId || null,
            productName: form.productName || productName || '',
          }
        }),
      },
      customFields: customFieldValues,
    }
  }, [
    additionalAddresses,
    additionalForms,
    additionalHouseholds,
    contacts,
    customFieldValues,
    mailing,
    namedInsured,
    additionalFormProducts,
    residential,
  ])

  const serializeForms = useCallback((payload) => JSON.stringify(payload ?? {}), [])

  const showNotification = useCallback((message) => {
    setNotification({ message })
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current)
    }
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null)
    }, 4000)
  }, [])

  const notifySaveIfChanged = useCallback(
    (payload) => {
      const serialized = serializeForms(payload)
      const lastSaved = lastSavedSerializedRef.current
      if (lastSaved !== null && serialized !== lastSaved) {
        showNotification('Changes saved.')
      }
      lastSavedSerializedRef.current = serialized
      return serialized
    },
    [serializeForms, showNotification]
  )

  useEffect(() => {
    if (!hydrated) return
    const formsPayload = buildFormsPayload()
    formsPayloadRef.current = formsPayload
    if (lastSavedSerializedRef.current === null) {
      lastSavedSerializedRef.current = serializeForms(formsPayload)
    }
    if (typeof onFormDataChange === 'function') {
      onFormDataChange(formsPayload)
    }
    if (typeof onShareSnapshotChange !== 'function') return
    const buildSharePerson = (person, label) => ({
      label,
      fullName: hasNameFieldsInSchema ? buildFullName(person || {}) : '',
      dob: householdFieldKeySet.has('dob') ? person?.dob || '' : '',
      gender: householdFieldKeySet.has('gender') ? person?.gender || '' : '',
      details: buildHouseholdDetails(person || {}),
    })
    const primarySnapshot = buildSharePerson(
      namedInsured,
      namedInsured.relation ? namedInsured.relation : 'Primary Applicant'
    )
    const additionalHouseholdSnapshots = additionalHouseholds
      .filter((person) => hasNonEmptyValue(person))
      .map((person) => buildSharePerson(person, person?.relation || 'Additional Household Member'))
    const primaryContactSnapshot = contacts[0] || createContact()
    const primaryAddressSnapshot = {
      label: primaryAddressLabel,
      street1: residential?.address1 || '',
      details: buildAddressDetails(residential),
    }
    const additionalAddressSnapshots = additionalAddresses
      .filter((entry) => hasNonEmptyValue(entry))
      .map((entry, index) => ({
        label: getAdditionalAddressLabel(entry, index),
        street1: entry?.residential?.address1 || '',
        details: buildAddressDetails(entry?.residential),
      }))
    const snapshot = {
      household: {
        primary: primarySnapshot,
        additional: additionalHouseholdSnapshots,
      },
      address: {
        primary: primaryAddressSnapshot,
        additional: additionalAddressSnapshots,
      },
      additionalForms: additionalForms
        .map((form) => ({
          name: form?.name || '',
          questions: (form?.questions || [])
            .filter((question) => hasNonEmptyValue(question?.input))
            .map((question) => ({
              question: question?.question || '',
              input: question?.input || '',
            })),
        }))
        .filter((form) => form.questions.length > 0),
      forms: formsPayload,
    }
    onShareSnapshotChange(snapshot)
  }, [
    onShareSnapshotChange,
    onFormDataChange,
    hydrated,
    namedInsured,
    additionalHouseholds,
    primaryAddressLabel,
    contacts,
    residential,
    mailing,
    additionalAddresses,
    additionalForms,
    products,
    customFieldValues,
    buildFormsPayload,
    serializeForms,
  ])

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current)
      }
    }
  }, [])

  return (
    <main className="min-h-full">
      <div className="min-h-full w-full border border-slate-300 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
          Create your insurance passport
        </div>
        {notification && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="font-semibold">{notification.message}</div>
          </div>
        )}
        {showProgress && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Progress</span>
              <span>{progressSummary}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-[#0b3b8c]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
              {progressSteps.map((step) => {
                const isActive = activeSection === step.id
                const dotTone = step.complete
                  ? 'bg-emerald-500'
                  : isActive
                    ? 'bg-[#0b3b8c]'
                    : 'bg-slate-300'
                const labelTone = step.complete ? 'text-slate-800' : isActive ? 'text-slate-900' : 'text-slate-500'
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotTone}`} />
                    <span className={labelTone}>{step.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <nav className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {isSectionAllowed('household') && (
            <button
              type="button"
              className={`${tabButton} w-full`}
              onClick={() => openSection('household')}
            >
              {householdSectionLabel}
            </button>
          )}
          {isSectionAllowed('address') && (
            <button
              type="button"
              className={`${tabButton} w-full`}
              onClick={() => openSection('address')}
            >
              {addressSectionLabel}
            </button>
          )}
          {isSectionAllowed('additional') && (
            <button type="button" className={`${tabButton} w-full`} onClick={() => openSection('additional')}>
              {additionalSectionLabel}
            </button>
          )}
          {isSectionAllowed('summary') && (
            <button type="button" className={`${tabButton} w-full`} onClick={() => openSection('summary')}>
              Summary
            </button>
          )}
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
                    <div className="text-sm font-semibold text-slate-900">{householdSectionLabel}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeHousehold.label}</div>
                      <div className={`mt-3 ${gridClass}`}>
                        <div className="contents">
                          <FieldRow
                            id={`${activeHousehold.idPrefix}-relation`}
                            label="Relation To Applicant"
                            options={relationToApplicantOptions}
                            value={activeHousehold.person.relation}
                            onChange={(event) =>
                              activeHousehold.setPerson((prev) => ({ ...prev, relation: event.target.value }))
                            }
                          />
                          {householdErrors.relation && (
                            <div className="col-span-2 text-xs text-rose-600">{householdErrors.relation}</div>
                          )}
                        </div>
                        {activeHouseholdFieldRows.map((field) => {
                          const errorKey = field.key || field.id
                          return (
                            <div key={field.id} className="contents">
                              <FieldRow {...field} />
                              {householdErrors[errorKey] && (
                                <div className="col-span-2 text-xs text-rose-600">
                                  {householdErrors[errorKey]}
                                </div>
                              )}
                            </div>
                          )
                        })}
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
                        onClick={handleHouseholdSaveContinue}
                        disabled={householdSaving}
                      >
                        {householdSaving ? 'Saving...' : 'Save & Continue'}
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
                      {primarySummaryRows.length ? (
                        primarySummaryRows.map((item, index) => (
                          <div key={`primary-summary-${index}`}>
                            <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                            {summaryValue(item.value)}
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500">No household details added.</div>
                      )}
                    </div>
                  </div>

                  {additionalHouseholds.map((person, index) => {
                    const additionalTitle = person.relation
                      ? person.relation
                      : `Additional Household Member ${index + 1}`
                    const fullName = buildFullName(person)
                    const summaryRows = buildHouseholdSummaryRows(fullName)
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
                          {summaryRows.length ? (
                            summaryRows.map((item, idx) => (
                              <div key={`additional-summary-${index}-${idx}`}>
                                <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                {summaryValue(item.value)}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-500">No household details added.</div>
                          )}
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
                        openSection('address')
                        setActiveAddressIndex('primary')
                        if (hasAddressData && addressComplete) {
                          setAddressEditing(false)
                        } else {
                          setAddressEditing(true)
                        }
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
                    <div className={`mt-3 ${gridClass}`}>
                      {orderedResidentialFields.map((field) => {
                        const isAddressType = field.id === 'addressType'
                        const value = isAddressType
                          ? newAddress.residential?.addressType ?? newAddress.addressType ?? ''
                          : newAddress.residential?.[field.id] ?? ''
                        return (
                          <FieldRow
                            key={`new-res-${field.id}`}
                            id={`new-res-${field.id}`}
                            label={field.label}
                            type={field.type}
                            options={isAddressType ? addressTypeOptions : undefined}
                            placeholder={isAddressType ? 'Select address type' : undefined}
                            value={value}
                            onChange={(event) =>
                              isAddressType
                                ? setNewAddress((prev) => ({
                                    ...prev,
                                    addressType: event.target.value,
                                    residential: { ...(prev.residential ?? {}), addressType: event.target.value },
                                  }))
                                : setNewAddress((prev) => ({
                                    ...prev,
                                    residential: { ...(prev.residential ?? {}), [field.id]: event.target.value },
                                  }))
                            }
                          />
                        )
                      })}
                    </div>

                    <div className={`mt-4 ${gridClass}`}>
                      <label htmlFor="new-address-residents" className={labelClass}>
                        Who lives in this address
                      </label>
                      {householdMemberOptions.length ? (
                        <MultiSelectDropdown
                          id="new-address-residents"
                          options={householdMemberOptions}
                          selectedIds={newAddressResidents}
                          onToggle={toggleNewAddressResident}
                          placeholder="Select household members"
                        />
                      ) : (
                        <div className="text-xs text-slate-500">
                          Add household members to select who lives here.
                        </div>
                      )}
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
                    <div className="text-sm font-semibold text-slate-900">{addressSectionLabel}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeAddressLabel}</div>
                    </div>
                    {addressQuestionRows.length > 0 && (
                      <div className={`mt-3 ${gridClass}`}>
                        {addressQuestionRows.map((row) => {
                          if (row.type === 'residents') {
                            return (
                              <div key={row.id} className="contents">
                                <label htmlFor="address-residents" className={labelClass}>
                                  {row.label}
                                </label>
                                {householdMemberOptions.length ? (
                                  <MultiSelectDropdown
                                    id="address-residents"
                                    options={householdMemberOptions}
                                    selectedIds={activeAddressResidents}
                                    onToggle={toggleActiveAddressResident}
                                    placeholder="Select household members"
                                  />
                                ) : (
                                  <div className="text-xs text-slate-500">
                                    Add household members to select who lives here.
                                  </div>
                                )}
                                {addressErrors.residents && (
                                  <div className="col-span-2 text-xs text-rose-600">{addressErrors.residents}</div>
                                )}
                              </div>
                            )
                          }

                          if (row.type === 'customField') {
                            const field = row.customField
                            return (
                              <div key={row.id} className="contents">
                                <FieldRow {...field} />
                                {addressErrors[field.id] && (
                                  <div className="col-span-2 text-xs text-rose-600">
                                    {addressErrors[field.id]}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          if (row.type === 'custom') {
                            const value = customFieldValues?.address?.[row.customKey] ?? ''
                            return (
                              <div key={row.id} className="contents">
                                <FieldRow
                                  id={row.id}
                                  label={row.label}
                                  value={value}
                                  onChange={(event) => setCustomFieldValue('address', row.customKey, event.target.value)}
                                />
                                {addressErrors[row.customKey] && (
                                  <div className="col-span-2 text-xs text-rose-600">
                                    {addressErrors[row.customKey]}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          const isAddressType = row.fieldId === 'addressType'
                          const value = isAddressType
                            ? activeAddressType
                            : activeAddressResidential?.[row.fieldId] ?? ''
                          const handleChange = (event) =>
                            isAddressType
                              ? setActiveAddressType(event.target.value)
                              : setActiveAddressResidentialField(row.fieldId, event.target.value)
                          return (
                            <div key={row.id} className="contents">
                              <FieldRow
                                id={row.id}
                                label={row.label}
                                type={row.fieldType}
                                options={isAddressType ? addressTypeOptions : undefined}
                                placeholder={isAddressType ? 'Select address type' : undefined}
                                value={value}
                                onChange={handleChange}
                              />
                              {addressErrors[row.fieldId] && (
                                <div className="col-span-2 text-xs text-rose-600">
                                  {addressErrors[row.fieldId]}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

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
                        onClick={handleAddressSaveContinue}
                        disabled={addressSaving}
                      >
                        {addressSaving ? 'Saving...' : 'Save & Continue'}
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
                        <span className="font-semibold text-slate-900">Street Address:</span>{' '}
                        {summaryValue(residential.address1)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">City:</span> {summaryValue(residential.city)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">State:</span> {summaryValue(residential.state)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Zip Code:</span> {summaryValue(residential.zip)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Who lives here:</span>{' '}
                        {formatResidentSummary(residential.residents || [])}
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
                          {getAdditionalAddressLabel(address, index)}
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
                          <span className="font-semibold text-slate-900">Street Address:</span>{' '}
                          {summaryValue(address.residential?.address1)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">City:</span>{' '}
                          {summaryValue(address.residential?.city)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">State:</span>{' '}
                          {summaryValue(address.residential?.state)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Zip Code:</span>{' '}
                          {summaryValue(address.residential?.zip)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Who lives here:</span>{' '}
                          {formatResidentSummary(address.residential?.residents || [])}
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

        {showAdditionalSection && (
          <>
            {showAdditionalForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">{additionalSectionLabel}</div>
                    {Object.keys(additionalErrors).length > 0 && (
                      <div className="text-xs text-rose-600">
                        Fix the highlighted fields before continuing.
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="text-sm text-slate-600">
                        You can create your own forms or choose from existing products.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'existing', label: 'Choose existing product' },
                          { id: 'custom', label: 'Create custom product' },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                              additionalFormMode === option.id
                                ? 'bg-[#0b3b8c] text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                            onClick={() => setAdditionalFormMode(option.id)}
                            disabled={typeof activeAdditionalFormIndex === 'number'}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {additionalFormMode === 'existing' && (
                        <div className={`${gridClass} items-start`}>
                          <label htmlFor="additional-form-product" className={labelClass}>
                            Choose a product
                          </label>
                          <select
                            id="additional-form-product"
                            className={inputClass}
                            value={additionalFormProductId}
                            onChange={(event) => {
                              setAdditionalFormProductId(event.target.value)
                              setAdditionalFormError('')
                            }}
                            disabled={typeof activeAdditionalFormIndex === 'number'}
                          >
                            <option value="">- Select a product -</option>
                            {(additionalFormProducts.length
                              ? additionalFormProducts
                              : additionalFormProductOptions.map((name) => ({ id: name, name }))).map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {additionalFormMode === 'custom' && (
                        <div className={`${gridClass} items-start`}>
                          <label htmlFor="additional-form-name" className={labelClass}>
                            Custom form name
                          </label>
                          <input
                            id="additional-form-name"
                            className={inputClass}
                            value={additionalFormName}
                            onChange={(event) => setAdditionalFormName(event.target.value)}
                            placeholder="Type your custom form name"
                          />
                        </div>
                      )}
                      {additionalFormError && (
                        <div className="text-xs font-semibold text-red-600">{additionalFormError}</div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(additionalFormMode === 'existing' && additionalFormProductId) ||
                      (additionalFormMode === 'custom' && additionalFormName.trim()) ? (
                        <>
                          <div className="space-y-2">
                            {additionalQuestions.map((question, index) => (
                              <div key={`additional-question-${index}`} className={gridClass}>
                                <QuestionAutocomplete
                                  value={question.question}
                                  placeholder="Question"
                                  ariaLabel="Question"
                                  onChange={(value) => updateAdditionalQuestion(index, 'question', value)}
                                  productId={additionalFormProductId}
                                  resetKey={`${additionalFormMode}-${additionalFormProductId || 'custom'}-${activeAdditionalFormIndex ?? 'new'}`}
                                  inputClassName={additionalQuestionInputClass}
                                  multiline
                                />
                                {isDriverQuestion(question.question) ? (
                                  householdMemberOptions.length ? (
                                    <MultiSelectDropdown
                                      id={`additional-driver-${index}`}
                                      options={householdMemberOptions}
                                      selectedIds={Array.isArray(question.input) ? question.input : []}
                                      onToggle={(id) => toggleAdditionalQuestionResident(index, id)}
                                      placeholder="Select household members"
                                    />
                                  ) : (
                                    <div className="text-xs text-slate-500">
                                      Add household members to select who drives this car.
                                    </div>
                                  )
                                ) : (
                                  <input
                                    className={inputClass}
                                    placeholder="Answer"
                                    aria-label="Answer"
                                    value={question.input}
                                    onChange={(event) => updateAdditionalQuestion(index, 'input', event.target.value)}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button type="button" className={miniButton} onClick={addAdditionalQuestion}>
                              Add question
                            </button>
                            <button
                              type="button"
                              className={miniButton}
                              onClick={removeAdditionalQuestion}
                              disabled={additionalQuestions.length <= baseAdditionalQuestionKeys.length}
                            >
                              Remove question
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {additionalFormMode === 'existing'
                            ? 'Select a product to add questions.'
                            : 'Enter a custom form name to add questions.'}
                        </div>
                      )}
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
                          if (additionalSaving) return
                          setAdditionalSaving(true)
                          try {
                            const productId = additionalFormProductId ? Number(additionalFormProductId) : null
                            const selectedProduct = products.find((product) => product.id === productId) || null
                            const resolvedName =
                              additionalFormMode === 'existing'
                                ? selectedProduct?.name || ''
                                : additionalFormName.trim()
                            if (!additionalFormMode) {
                              setAdditionalFormError('Please choose existing or custom first.')
                              setAdditionalSaving(false)
                              return
                            }
                            if (additionalFormMode === 'existing' && !productId) {
                              setAdditionalFormError('Please select a product.')
                              setAdditionalSaving(false)
                              return
                            }
                            if (additionalFormMode === 'custom' && !resolvedName) {
                              setAdditionalFormError('Please enter a custom form name.')
                              setAdditionalSaving(false)
                              return
                            }
                            const baseKeys = new Set(baseAdditionalQuestionKeysRef.current || [])
                            const questionsToSave =
                              additionalFormMode === 'existing'
                                ? additionalQuestions
                                    .map((question) => (question?.question || '').toString().trim())
                                    .filter((text) => text && !baseKeys.has(normalizeQuestionText(text)))
                                : additionalQuestions.map((question) => question.question)
                            await saveCustomerQuestions(questionsToSave, productId || null, resolvedName)
                            const nextForm = {
                              name: resolvedName,
                              questions: additionalQuestions,
                              productId: productId || null,
                              productName: selectedProduct?.name || '',
                            }
                            const buildNextForms = (prev) => {
                              if (typeof activeAdditionalFormIndex === 'number') {
                                const next = [...prev]
                                next[activeAdditionalFormIndex] = nextForm
                                return next
                              }
                              return [...prev, nextForm]
                            }
                            const nextAdditionalForms = buildNextForms(additionalForms)
                            if (typeof activeAdditionalFormIndex === 'number') {
                              setAdditionalForms((prev) => buildNextForms(prev))
                            } else {
                              setAdditionalForms((prev) => buildNextForms(prev))
                            }
                            setActiveAdditionalFormIndex(null)
                            const nextFormsPayload = buildFormsPayload({ additionalForms: nextAdditionalForms })
                            await handleAdditionalSaveContinue(nextFormsPayload, { skipSaving: true })
                          } catch (error) {
                            console.warn('Failed to save additional form', error)
                            setAdditionalSaving(false)
                          }
                        }}
                        disabled={additionalSaving}
                      >
                        {additionalSaving ? 'Saving...' : 'Save & Continue'}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {showAdditionalSummary && (
              <section className="mt-6">
                <div className="space-y-4">
                  {Object.keys(additionalErrors).length > 0 && (
                    <div className="text-xs text-rose-600">
                      Fix the highlighted fields before continuing.
                    </div>
                  )}
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
                            <div className="flex flex-wrap gap-4">
                              {(form.questions ?? []).slice(0, 3).map((question, questionIndex) => (
                                <div
                                  key={`additional-summary-${index}-${questionIndex}`}
                                  className="flex flex-wrap gap-2 text-sm text-slate-700"
                                >
                                  <span className="font-semibold text-[#006aff] break-words">
                                    {summaryValue(question.question)}:
                                  </span>
                                  <span>{formatAdditionalQuestionInput(question)}</span>
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
                    <button
                      type="button"
                      className={nextButton}
                      onClick={handleAdditionalSummaryContinue}
                      disabled={additionalSummarySaving}
                    >
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
                  <div className="text-sm font-semibold text-slate-900">{householdSectionLabel}</div>
                  <button type="button" className={miniButton} onClick={() => openSection('household')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  {primarySummaryRows.length ? (
                    primarySummaryRows.map((item, index) => (
                      <div key={`summary-primary-${index}`}>
                        <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                        {summaryValue(item.value)}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">No household details added.</div>
                  )}
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
                  <div className="text-sm font-semibold text-slate-900">{addressSectionLabel}</div>
                  <button type="button" className={miniButton} onClick={() => openSection('address')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Street Address:</span>{' '}
                    {summaryValue(residential.address1)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">City:</span> {summaryValue(residential.city)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">State:</span> {summaryValue(residential.state)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Zip Code:</span> {summaryValue(residential.zip)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Who lives here:</span>{' '}
                    {formatResidentSummary(residential.residents || [])}
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
                  <div className="text-sm font-semibold text-slate-900">{additionalSectionLabel}</div>
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
