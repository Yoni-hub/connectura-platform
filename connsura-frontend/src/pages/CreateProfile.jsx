import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { allOccupations, occupationMap } from '../data/occupationMap'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../services/api'
import { getStoredToken } from '../utils/authStorage'
import { reportError } from '../utils/errorReporting'
import Modal from '../components/ui/Modal'

const labelClass = 'text-sm text-slate-900'
const inputClass =
  'h-9 w-full justify-self-start border border-slate-700/60 bg-white px-2 text-sm text-slate-900 focus:border-[#006aff] focus:outline-none focus:ring-1 focus:ring-[#006aff]/20 sm:h-7'
const additionalQuestionInputClass =
  'w-full justify-self-start border-0 bg-transparent px-0 text-sm text-[#006aff] placeholder:text-[#7fb2ff] focus:outline-none focus:ring-0'
const gridClass = 'grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[150px_1fr] sm:items-center'
const nextButton = 'pill-btn-primary px-5 py-2 text-sm'
const miniButton = 'pill-btn-ghost px-3 py-1.5 text-xs'
const tabButton = 'pill-btn-ghost px-2 py-1 text-sm'
const defaultSelectPlaceholder = '- Please Select -'

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
          { signal: controller.signal, headers, credentials: 'include', cache: 'no-store' }
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
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const normalizeSelectOptionsList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (!value) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
    } catch {
      // Fall back to comma-separated parsing.
    }
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const resolveQuestionInputConfig = (inputType, selectOptions) => {
  const normalized = String(inputType || '').trim().toLowerCase()
  if (normalized === 'select') {
    return { type: 'select', options: normalizeSelectOptionsList(selectOptions) }
  }
  if (normalized === 'yes/no') {
    return { type: 'select', options: yesNoOptions }
  }
  if (['number', 'date', 'text'].includes(normalized)) {
    return { type: normalized, options: undefined }
  }
  return { type: 'text', options: undefined }
}

const resolveQuestionConfigWithFallback = (question, fallback) => {
  const normalized = String(question?.inputType || '').trim().toLowerCase()
  if (!normalized || normalized === 'general') return fallback
  const config = resolveQuestionInputConfig(normalized, question?.selectOptions)
  if (config.type === 'select' && (!config.options || config.options.length === 0) && fallback?.options?.length) {
    return { ...config, options: fallback.options }
  }
  return config
}

const buildQuestionCustomKey = (prefix, normalized) =>
  prefix ? `qb-${prefix}-${normalized}` : `qb-${normalized}`

const readResponseSnippet = async (res) => {
  if (!res) return null
  try {
    const text = await res.text()
    if (!text) return null
    return text.slice(0, 800)
  } catch {
    return null
  }
}

const householdRelationLabelSet = new Set([
  normalizeQuestionText('Relation To Applicant'),
  normalizeQuestionText('Relation to applicant'),
  normalizeQuestionText('Relationship to applicant'),
])

const addressFieldMappings = [
  { labels: ['Address Type'], target: 'residential', fieldId: 'addressType', defaultType: 'select' },
  { labels: ['Street Address', 'Street Address 1'], target: 'residential', fieldId: 'address1' },
  { labels: ['Street Address 2'], target: 'residential', fieldId: 'address2' },
  { labels: ['City'], target: 'residential', fieldId: 'city' },
  { labels: ['State'], target: 'residential', fieldId: 'state' },
  { labels: ['Zip Code', 'Zip'], target: 'residential', fieldId: 'zip' },
  {
    labels: ['Mailing Street Address', 'Mailing Street Address 1', 'Mailing Address', 'Mailing Address 1'],
    target: 'mailing',
    fieldId: 'address1',
  },
  { labels: ['Mailing Street Address 2', 'Mailing Address 2'], target: 'mailing', fieldId: 'address2' },
  { labels: ['Mailing City'], target: 'mailing', fieldId: 'city' },
  { labels: ['Mailing State'], target: 'mailing', fieldId: 'state' },
  { labels: ['Mailing Zip Code', 'Mailing Zip'], target: 'mailing', fieldId: 'zip' },
]
const addressFieldLabelMap = new Map()
addressFieldMappings.forEach((entry) => {
  entry.labels.forEach((label) => addressFieldLabelMap.set(normalizeQuestionText(label), entry))
})
const addressResidentLabelKey = normalizeQuestionText('Who lives in this address')

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
  editSection,
  editContext,
  onMobileEditNavigate,
  onEditBack,
}) {
  const { user } = useAuth()
  const [formSchema, setFormSchema] = useState(null)
  const [products, setProducts] = useState([])
  const [sectionBankQuestions, setSectionBankQuestions] = useState({ household: [], address: [] })
  const [householdQuestionsError, setHouseholdQuestionsError] = useState('')
  const householdQuestionsErrorReportedRef = useRef(false)
  const [addressQuestionsError, setAddressQuestionsError] = useState('')
  const addressQuestionsErrorReportedRef = useRef(false)
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
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth < 640 : false)
  )
  const isEditScreen = Boolean(editSection)
  const [slideIn, setSlideIn] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const prefillKeyRef = useRef('')
  const formsPayloadRef = useRef(null)
  const lastSavedSerializedRef = useRef(null)
  const lastSavedFormsRef = useRef(null)
  const notificationTimerRef = useRef(null)
  const [notification, setNotification] = useState(null)
  const [unsavedPrompt, setUnsavedPrompt] = useState({ open: false, saving: false, onYes: null, onNo: null })
  const baseAdditionalQuestionKeysRef = useRef([])
  const sectionProductIdsRef = useRef({ household: '', address: '' })
  const suppressModeResetRef = useRef(false)
  const initialDataRef = useRef(false)
  const lastInitialSerializedRef = useRef(null)
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
  const normalizeQuestionLabel = (value = '') => String(value ?? '').trim().toLowerCase()
  const isDriverQuestion = (value = '') => normalizeQuestionLabel(value) === driverQuestionKey
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isEditScreen || !isMobile) {
      setSlideIn(false)
      return
    }
    const frame = window.requestAnimationFrame(() => setSlideIn(true))
    return () => window.cancelAnimationFrame(frame)
  }, [isEditScreen, isMobile])

  const additionalFormProducts = useMemo(
    () => products.filter((product) => !sectionQuestionProductSlugSet.has(product.slug)),
    [products]
  )

  const resolveAdditionalProductName = (value) => {
    if (!value) return ''
    const match = additionalFormProducts.find((product) => String(product.id) === String(value))
    if (match?.name) return match.name
    if (additionalFormProductOptions.includes(value)) return value
    return ''
  }

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
    const emptyBankMessage = 'there are no questions in the question bank'
    if (!productId) {
      if (sectionKey === 'household') {
        const message = 'something went wrong please try again later'
        setHouseholdQuestionsError(message)
        if (!householdQuestionsErrorReportedRef.current) {
          householdQuestionsErrorReportedRef.current = true
          reportError({
            source: 'create-profile',
            message: 'Household questions product not found',
            metadata: {
              sectionKey,
              productId: null,
              productsCount: products.length,
              productSlugs: products.map((product) => product.slug).slice(0, 12),
            },
          })
        }
      }
      if (sectionKey === 'address') {
        const message = 'something went wrong please try again later'
        setAddressQuestionsError(message)
        if (!addressQuestionsErrorReportedRef.current) {
          addressQuestionsErrorReportedRef.current = true
          reportError({
            source: 'create-profile',
            message: 'Address questions product not found',
            metadata: {
              sectionKey,
              productId: null,
              productsCount: products.length,
              productSlugs: products.map((product) => product.slug).slice(0, 12),
            },
          })
        }
      }
      return
    }
    try {
      const token = getStoredToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_URL}/questions/product?productId=${encodeURIComponent(productId)}`, {
        headers,
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.status === 304) return
      if (!res.ok) {
        const responseBody = await readResponseSnippet(res)
        if (sectionKey === 'household') {
          const message = 'something went wrong please try again later'
          setHouseholdQuestionsError(message)
          if (!householdQuestionsErrorReportedRef.current) {
            householdQuestionsErrorReportedRef.current = true
            reportError({
              source: 'create-profile',
              message: 'Household questions request failed',
              metadata: {
                sectionKey,
                productId,
                status: res.status,
                statusText: res.statusText,
                url: res.url,
                responseBody,
              },
            })
          }
        }
        if (sectionKey === 'address') {
          const message = 'something went wrong please try again later'
          setAddressQuestionsError(message)
          if (!addressQuestionsErrorReportedRef.current) {
            addressQuestionsErrorReportedRef.current = true
            reportError({
              source: 'create-profile',
              message: 'Address questions request failed',
              metadata: {
                sectionKey,
                productId,
                status: res.status,
                statusText: res.statusText,
                url: res.url,
                responseBody,
              },
            })
          }
        }
        return
      }
      const data = await res.json()
      const bankQuestions = Array.isArray(data.questions) ? data.questions : []
      const systemQuestions = bankQuestions.filter(
        (question) => question?.source === 'SYSTEM' || !question?.source
      )
      const customerQuestions = bankQuestions.filter((question) => question?.source === 'CUSTOMER')
      const mergedQuestions = [...systemQuestions, ...customerQuestions]
      const seen = new Set()
      const normalized = mergedQuestions
        .map((question) => ({
          text: question?.text || '',
          key: normalizeQuestionText(question?.text || ''),
          inputType: question?.inputType || 'general',
          selectOptions: normalizeSelectOptionsList(question?.selectOptions),
          source: question?.source || 'SYSTEM',
        }))
        .filter((entry) => {
          if (!entry.key || seen.has(entry.key)) return false
          seen.add(entry.key)
          return true
        })
      if (normalized.length === 0) {
        if (sectionKey === 'household') {
          const message = emptyBankMessage
          setHouseholdQuestionsError(message)
          if (!householdQuestionsErrorReportedRef.current) {
            householdQuestionsErrorReportedRef.current = true
            reportError({
              source: 'create-profile',
              message: 'Household question bank empty',
              metadata: {
                sectionKey,
                productId,
                questionCount: bankQuestions.length,
                systemCount: systemQuestions.length,
                customerCount: customerQuestions.length,
                url: res.url,
              },
            })
          }
        }
        if (sectionKey === 'address') {
          const message = emptyBankMessage
          setAddressQuestionsError(message)
          if (!addressQuestionsErrorReportedRef.current) {
            addressQuestionsErrorReportedRef.current = true
            reportError({
              source: 'create-profile',
              message: 'Address question bank empty',
              metadata: {
                sectionKey,
                productId,
                questionCount: bankQuestions.length,
                systemCount: systemQuestions.length,
                customerCount: customerQuestions.length,
                url: res.url,
              },
            })
          }
        }
        return
      }
      if (sectionKey === 'household') setHouseholdQuestionsError('')
      if (sectionKey === 'address') setAddressQuestionsError('')
      setSectionBankQuestions((prev) => ({
        ...prev,
        [sectionKey]: normalized,
      }))
    } catch (error) {
      console.warn(`Failed to load ${sectionKey} question bank`, error)
      if (sectionKey === 'household') {
        const message = 'something went wrong please try again later'
        setHouseholdQuestionsError(message)
        if (!householdQuestionsErrorReportedRef.current) {
          householdQuestionsErrorReportedRef.current = true
          reportError({
            source: 'create-profile',
            message: 'Household questions load exception',
            stack: error?.stack,
            metadata: {
              sectionKey,
              productId,
              error: error?.message,
              endpoint: 'questions/product',
            },
          })
        }
      }
      if (sectionKey === 'address') {
        const message = 'something went wrong please try again later'
        setAddressQuestionsError(message)
        if (!addressQuestionsErrorReportedRef.current) {
          addressQuestionsErrorReportedRef.current = true
          reportError({
            source: 'create-profile',
            message: 'Address questions load exception',
            stack: error?.stack,
            metadata: {
              sectionKey,
              productId,
              error: error?.message,
              endpoint: 'questions/product',
            },
          })
        }
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const loadSchema = async () => {
      try {
      const res = await fetch(`${API_URL}/form-schema/create-profile`, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-store',
      })
        if (!res.ok) {
          const responseBody = await readResponseSnippet(res)
          reportError({
            source: 'create-profile',
            message: 'Create profile schema request failed',
            metadata: {
              status: res.status,
              statusText: res.statusText,
              url: res.url,
              responseBody,
            },
          })
          return
        }
        const data = await res.json()
        if (data?.schema?.schema) {
          setFormSchema(data.schema.schema)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setFormSchema(null)
          reportError({
            source: 'create-profile',
            message: 'Create profile schema load exception',
            stack: error?.stack,
            metadata: { error: error?.message, endpoint: 'form-schema/create-profile' },
          })
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
      const res = await fetch(`${API_URL}/products`, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-store',
      })
        if (!res.ok) {
          const responseBody = await readResponseSnippet(res)
          reportError({
            source: 'create-profile',
            message: 'Products request failed',
            metadata: {
              status: res.status,
              statusText: res.statusText,
              url: res.url,
              responseBody,
            },
          })
          return
        }
        const data = await res.json()
        const items = Array.isArray(data.products) ? data.products : []
        setProducts(items)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setProducts([])
          reportError({
            source: 'create-profile',
            message: 'Products load exception',
            stack: error?.stack,
            metadata: { error: error?.message, endpoint: 'products' },
          })
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
      const nextBase = { question: driverQuestionLabel, input: normalizedInput, source: 'SYSTEM' }
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
    if (!initialData) {
      setHydrated(true)
      return
    }
    const serialized = JSON.stringify(initialData ?? {})
    if (lastInitialSerializedRef.current === serialized && initialDataRef.current) return
    const lastSaved = lastSavedSerializedRef.current
    const currentSerialized =
      formsPayloadRef.current ? JSON.stringify(formsPayloadRef.current) : null
    const hasUnsavedLocalChanges =
      lastSaved !== null && currentSerialized !== null && currentSerialized !== lastSaved
    if (initialDataRef.current && hasUnsavedLocalChanges) return
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
    setHouseholdErrors({})
    setAddressErrors({})
    setAdditionalErrors({})
    setShowAddHouseholdModal(false)
    setShowAddAddressModal(false)
    setNewHousehold(createHouseholdMember())
    setNewAddress(createAddressEntry())
    formsPayloadRef.current = initialData
    lastSavedSerializedRef.current = serialized
    lastSavedFormsRef.current = JSON.parse(JSON.stringify(initialData))
    lastInitialSerializedRef.current = serialized
    initialDataRef.current = true
    setHydrated(true)
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
  const fallbackHouseholdFields = [
    { id: 'first-name', label: 'First Name', type: 'text' },
    { id: 'middle-initial', label: 'Middle Initial', type: 'text' },
    { id: 'last-name', label: 'Last Name', type: 'text' },
    { id: 'suffix', label: 'Suffix', type: 'text' },
    { id: 'dob', label: 'Date of Birth', type: 'date' },
    { id: 'gender', label: 'Gender', type: 'select' },
    { id: 'marital-status', label: 'Marital Status', type: 'select' },
    { id: 'education-level', label: 'Education Level', type: 'select' },
    { id: 'employment', label: 'Employment', type: 'select' },
    { id: 'occupation', label: 'Occupation', type: 'text' },
    { id: 'driver-status', label: 'Driver Status', type: 'select' },
    { id: 'license-type', label: "Driver's License Type", type: 'select' },
    { id: 'license-status', label: 'License Status', type: 'select' },
    { id: 'years-licensed', label: 'Years Licensed', type: 'select' },
    { id: 'license-state', label: 'License State', type: 'select' },
    { id: 'license-number', label: 'License Number', type: 'text' },
    { id: 'accident-prevention', label: 'Accident Prevention Course', type: 'select' },
    { id: 'sr22', label: 'SR-22 Required?', type: 'select' },
    { id: 'fr44', label: 'FR-44 Required?', type: 'select' },
  ]
  const schema = formSchema || { sections: {} }
  const householdSchemaFields = schema.sections?.household?.fields || []
  const householdFieldSource =
    Array.isArray(householdSchemaFields) && householdSchemaFields.length
      ? householdSchemaFields
      : fallbackHouseholdFields
  const householdFieldByLabel = useMemo(() => {
    const map = new Map()
    householdFieldSource
      .filter((field) => !field?.removed && field?.visible !== false)
      .forEach((field) => {
        const normalized = normalizeQuestionText(field?.label || '')
        if (!normalized) return
        map.set(normalized, {
          key: field.id,
          label: field.label,
          type: field.type || 'text',
          options: field.options,
        })
      })
    return map
  }, [householdFieldSource])
  const rawAddressTypeOptions = Array.isArray(schema.sections?.address?.addressTypes)
    ? schema.sections.address.addressTypes
    : []
  const addressTypeOptions = rawAddressTypeOptions
    .map((option) => String(option ?? '').trim())
    .filter(Boolean)
  const householdSectionLabel = schema.sections?.household?.label || 'Household Information'
  const addressSectionLabel = schema.sections?.address?.label || 'Address Information'
  const additionalSectionLabel = schema.sections?.additional?.label || 'Additional Information'
  const householdSectionName = 'Household Information'
  const addressSectionName = 'Address Information'
  const additionalSectionName = 'Additional Information'
  const householdQuestionsUnavailable = Boolean(householdQuestionsError)
  const addressQuestionsUnavailable = Boolean(addressQuestionsError)
  const navigateBack = useCallback(() => {
    if (typeof onEditBack === 'function') {
      onEditBack()
      return
    }
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }, [onEditBack])
  const editSectionLabel = useMemo(() => {
    if (!editSection) return ''
    if (editSection === 'household') return householdSectionLabel
    if (editSection === 'address') return addressSectionLabel
    if (editSection === 'additional') return additionalSectionLabel
    if (editSection === 'summary') return 'Summary'
    return ''
  }, [editSection, householdSectionLabel, addressSectionLabel, additionalSectionLabel])

  const validateHousehold = () => {
    return {}
  }

  const validateAddress = () => {
    return {}
  }

  const validateAdditional = () => {
    return {}
  }

  const resolveFormsOverride = (value) => {
    if (value && typeof value === 'object' && 'nativeEvent' in value) {
      return undefined
    }
    return value
  }

  const handleHouseholdSaveContinue = async (formsOverride, options = {}) => {
    const resolvedOverride = resolveFormsOverride(formsOverride)
    if (householdSaving) return
    setHouseholdSaving(true)
    const wasComplete = householdComplete
    const errors = validateHousehold()
    setHouseholdErrors(errors)
    if (Object.keys(errors).length > 0) {
      setHouseholdSaving(false)
      return false
    }
    let saveResult = { success: true }
    let savedPayload = resolvedOverride || null
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = resolvedOverride || buildFormsPayload()
        formsPayloadRef.current = formsPayload
        savedPayload = formsPayload
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
      return false
    }
    const payloadForNotification = savedPayload || formsPayloadRef.current
    if (payloadForNotification) {
      notifySaveIfChanged(payloadForNotification)
    }
    setHouseholdComplete(true)
    if (isEditScreen) {
      setHouseholdSaving(false)
      if (!options.skipNavigate) {
        navigateBack()
      }
      return true
    }
    setHouseholdEditing(false)
    if (!wasComplete) {
      openSection('address')
      setAddressEditing(true)
    }
    setHouseholdSaving(false)
    return true
  }

  const handleAddressSaveContinue = async (formsOverride, options = {}) => {
    const resolvedOverride = resolveFormsOverride(formsOverride)
    if (addressSaving) return
    setAddressSaving(true)
    const errors = validateAddress()
    setAddressErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAddressSaving(false)
      return false
    }
    let saveResult = { success: true }
    let savedPayload = resolvedOverride || null
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = resolvedOverride || buildFormsPayload()
        formsPayloadRef.current = formsPayload
        savedPayload = formsPayload
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
      return false
    }
    const payloadForNotification = savedPayload || formsPayloadRef.current
    if (payloadForNotification) {
      notifySaveIfChanged(payloadForNotification)
    }
    setAddressComplete(true)
    if (isEditScreen) {
      setAddressSaving(false)
      if (!options.skipNavigate) {
        navigateBack()
      }
      return true
    }
    setAddressEditing(false)
    setAddressSaving(false)
    return true
  }

  const handleAdditionalSaveContinue = async (formsOverride, options = {}) => {
    const resolvedOverride = resolveFormsOverride(formsOverride)
    if (additionalSaving && !options.skipSaving) return
    if (!options.skipSaving) {
      setAdditionalSaving(true)
    }
    const errors = validateAdditional()
    setAdditionalErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAdditionalSaving(false)
      return false
    }
    let saveResult = { success: true }
    let savedPayload = resolvedOverride || null
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = resolvedOverride || buildFormsPayload()
        formsPayloadRef.current = formsPayload
        savedPayload = formsPayload
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
      return false
    }
    const payloadForNotification = savedPayload || formsPayloadRef.current
    if (payloadForNotification) {
      notifySaveIfChanged(payloadForNotification)
    }
    setAdditionalComplete(true)
    if (isEditScreen) {
      setAdditionalSaving(false)
      if (!options.skipNavigate) {
        navigateBack()
      }
      return true
    }
    setAdditionalEditing(false)
    setAdditionalSaving(false)
    return true
  }

  const handleAdditionalSummaryContinue = async () => {
    if (additionalSummarySaving) return
    setAdditionalSummarySaving(true)
    let saveResult = { success: true }
    try {
      if (typeof onSectionSave === 'function') {
        const formsPayload = buildFormsPayload()
        formsPayloadRef.current = formsPayload
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

  const buildQuestionBankRows = (
    sectionKey,
    idPrefix,
    questions = [],
    excludeKeys = new Set(),
    valueKeyPrefix = ''
  ) =>
    questions
      .map((question, index) => {
        const text = question?.text || ''
        const normalized = normalizeQuestionText(text)
        const keySuffix = valueKeyPrefix ? `${valueKeyPrefix}-${normalized}` : normalized
        const key = `qb-${keySuffix}`
        if (!text || key === 'qb-' || excludeKeys.has(normalized)) return null
        const { type, options } = resolveQuestionInputConfig(question?.inputType, question?.selectOptions)
        return {
          id: `${idPrefix}-${index}`,
          label: text,
          type,
          options,
          value: customFieldValues?.[sectionKey]?.[key] ?? '',
          onChange: (event) => setCustomFieldValue(sectionKey, key, event.target.value),
        }
      })
      .filter(Boolean)

  const buildHouseholdQuestionRows = (person, setPerson, idPrefix, valueKeyPrefix = '') => {
    const occupationOptionsForEmployment =
      specialEmploymentOccupations[person.employment] ||
      (occupationMap[person.employment]?.length ? occupationMap[person.employment] : allOccupations)
    const isOccupationLocked = Boolean(specialEmploymentOccupations[person.employment])

    const resolveMappedConfig = (field, question) => {
      const fallback =
        field?.options?.length
          ? { type: 'select', options: field.options }
          : { type: field?.type || 'text', options: undefined }
      return resolveQuestionConfigWithFallback(question, fallback)
    }

    return sectionBankQuestions.household
      .map((question, index) => {
        const label = (question?.text || '').toString().trim()
        const normalized = normalizeQuestionText(label)
        if (!label || !normalized) return null

        if (householdRelationLabelSet.has(normalized)) {
          const config = resolveQuestionConfigWithFallback(question, {
            type: 'select',
            options: relationToApplicantOptions,
          })
          return {
            id: `${idPrefix}-relation-${index}`,
            label,
            type: config.type,
            options: config.options,
            value: person.relation ?? '',
            errorKey: 'relation',
            fieldKey: 'relation',
            onChange: (event) => setPerson((prev) => ({ ...prev, relation: event.target.value })),
          }
        }

        const mappedField = householdFieldByLabel.get(normalized)
        if (mappedField) {
          const config = resolveMappedConfig(mappedField, question)
          if (mappedField.key === 'employment') {
            const handleEmploymentChange = (event) => {
              const nextEmployment = event.target.value
              if (config.type !== 'select') {
                setPerson((prev) => ({ ...prev, employment: nextEmployment }))
                return
              }
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
            return {
              id: `${idPrefix}-${mappedField.key}-${index}`,
              label,
              type: config.type,
              options: config.options,
              value: person.employment ?? '',
              errorKey: mappedField.key,
              fieldKey: mappedField.key,
              onChange: handleEmploymentChange,
            }
          }
          if (mappedField.key === 'occupation') {
            const optionOverride =
              config.type === 'select'
                ? config.options?.length
                  ? config.options
                  : occupationOptionsForEmployment
                : config.options
            return {
              id: `${idPrefix}-${mappedField.key}-${index}`,
              label,
              type: config.type,
              options: optionOverride,
              disabled: config.type === 'select' && !config.options?.length ? isOccupationLocked : false,
              value: person.occupation ?? '',
              errorKey: mappedField.key,
              fieldKey: mappedField.key,
              onChange: (event) => setPerson((prev) => ({ ...prev, occupation: event.target.value })),
            }
          }
          return {
            id: `${idPrefix}-${mappedField.key}-${index}`,
            label,
            type: config.type,
            options: config.options,
            value: person[mappedField.key] ?? '',
            errorKey: mappedField.key,
            fieldKey: mappedField.key,
            onChange: (event) => setPerson((prev) => ({ ...prev, [mappedField.key]: event.target.value })),
          }
        }

        const customKey = buildQuestionCustomKey(valueKeyPrefix, normalized)
        const config = resolveQuestionInputConfig(question?.inputType, question?.selectOptions)
        return {
          id: `${idPrefix}-custom-${index}`,
          label,
          type: config.type,
          options: config.options,
          value: customFieldValues?.household?.[customKey] ?? '',
          errorKey: customKey,
          customKey,
          onChange: (event) => setCustomFieldValue('household', customKey, event.target.value),
        }
      })
      .filter(Boolean)
  }

  const newHouseholdFields = buildHouseholdQuestionRows(newHousehold, setNewHousehold, 'hh-new', 'new')
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

  const editAdditionalForm = useCallback(
    (index) => {
      const form = additionalForms[index] ?? { name: '', questions: [], productId: null }
      const fallbackProduct =
        additionalFormProducts.find(
          (product) => product.name === form.productName || product.name === form.name
        ) || null
      const resolvedProductId = form.productId || fallbackProduct?.id || ''
      setActiveAdditionalFormIndex(index)
      if (resolvedProductId) {
        suppressModeResetRef.current = true
        setAdditionalFormMode('existing')
        setAdditionalFormProductId(String(resolvedProductId))
        setAdditionalFormName('')
      } else {
        suppressModeResetRef.current = true
        setAdditionalFormMode('custom')
        setAdditionalFormProductId('')
        setAdditionalFormName(form.name ?? '')
      }
      setAdditionalQuestions(form.questions ?? [])
      setBaseAdditionalQuestionKeys([])
      setAdditionalFormError('')
      setAdditionalEditing(true)
    },
    [additionalForms, additionalFormProducts]
  )

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

  const handleAdditionalFormSave = async (options = {}) => {
    if (additionalSaving) return false
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
        return false
      }
      if (additionalFormMode === 'existing' && !productId) {
        setAdditionalFormError('Please select a product.')
        setAdditionalSaving(false)
        return false
      }
      if (additionalFormMode === 'custom' && !resolvedName) {
        setAdditionalFormError('Please enter a custom form name.')
        setAdditionalSaving(false)
        return false
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
      setAdditionalForms((prev) => buildNextForms(prev))
      setActiveAdditionalFormIndex(null)
      const nextFormsPayload = buildFormsPayload({ additionalForms: nextAdditionalForms })
      await handleAdditionalSaveContinue(nextFormsPayload, {
        skipSaving: true,
        skipNavigate: options.skipNavigate,
      })
      return true
    } catch (error) {
      console.warn('Failed to save additional form', error)
      setAdditionalSaving(false)
      return false
    }
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
        cache: 'no-store',
      })
      if (!res.ok) {
        const responseBody = await readResponseSnippet(res)
        reportError({
          source: 'create-profile',
          message: 'Additional form questions request failed',
          metadata: {
            productId,
            status: res.status,
            statusText: res.statusText,
            url: res.url,
            responseBody,
          },
        })
        return
      }
      const data = await res.json()
      const bankQuestions = Array.isArray(data.questions) ? data.questions : []
      const systemQuestions = bankQuestions.filter(
        (question) => question?.source === 'SYSTEM' || !question?.source
      )
      const customerQuestions = bankQuestions.filter((question) => question?.source === 'CUSTOMER')
      const systemList = systemQuestions
        .map((question) => ({
          text: question?.text || '',
          key: normalizeQuestionText(question?.text || ''),
          inputType: question?.inputType || 'general',
          selectOptions: normalizeSelectOptionsList(question?.selectOptions),
        }))
        .filter((entry) => entry.key)
      const customerList = customerQuestions
        .map((question) => ({
          text: question?.text || '',
          key: normalizeQuestionText(question?.text || ''),
        }))
        .filter((entry) => entry.key && !systemList.some((entryItem) => entryItem.key === entry.key))
      const systemKeys = systemList.map((entry) => entry.key)
      const customerKeys = customerList.map((entry) => entry.key)
      const existingMap = new Map(
        additionalQuestions
          .map((question) => ({
            key: normalizeQuestionText(question?.question || ''),
            input: question?.input ?? '',
            source: question?.source,
          }))
          .filter((entry) => entry.key)
          .map((entry) => [entry.key, entry])
      )
      const baseEntries = systemList.map((entry) => ({
        question: entry.text,
        input: existingMap.has(entry.key) ? existingMap.get(entry.key)?.input ?? '' : '',
        source: 'SYSTEM',
        inputType: entry.inputType || 'general',
        selectOptions: entry.selectOptions || [],
      }))
      const customerEntries = customerList.map((entry) => ({
        question: entry.text,
        input: existingMap.has(entry.key) ? existingMap.get(entry.key)?.input ?? '' : '',
        source: 'CUSTOMER',
        inputType: 'general',
        selectOptions: [],
      }))
      const extraEntries = additionalQuestions
        .map((question) => ({
          question: question?.question || '',
          input: question?.input ?? '',
          source: 'CUSTOMER',
          inputType: question?.inputType || 'general',
          selectOptions: normalizeSelectOptionsList(question?.selectOptions),
          key: normalizeQuestionText(question?.question || ''),
        }))
        .filter(
          (entry) =>
            entry.key &&
            !systemKeys.includes(entry.key) &&
            !customerKeys.includes(entry.key)
        )
        .map(({ key, ...entry }) => entry)
      setAdditionalQuestions([...baseEntries, ...customerEntries, ...extraEntries])
      setBaseAdditionalQuestionKeys(systemKeys)
    } catch (error) {
      console.warn('Failed to load product questions', error)
      reportError({
        source: 'create-profile',
        message: 'Additional form questions load exception',
        stack: error?.stack,
        metadata: { productId, error: error?.message, endpoint: 'questions/product' },
      })
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

  const handleEditSection = useCallback(
    (section, options = {}) => {
      if (!section) return
      if (onMobileEditNavigate && isMobile && !isEditScreen) {
        onMobileEditNavigate(section, options)
        return
      }
      if (section === 'household') {
        openSection('household')
        setActiveHouseholdIndex(options.householdIndex ?? 'primary')
        setHouseholdEditing(true)
        return
      }
      if (section === 'address') {
        openSection('address')
        setActiveAddressIndex(options.addressIndex ?? 'primary')
        setAddressEditing(true)
        return
      }
      if (section === 'additional') {
        openSection('additional')
        if (typeof options.additionalFormIndex === 'number') {
          editAdditionalForm(options.additionalFormIndex)
        } else {
          setAdditionalEditing(true)
        }
        return
      }
      openSection(section)
    },
    [
      onMobileEditNavigate,
      isMobile,
      isEditScreen,
      openSection,
      editAdditionalForm,
    ]
  )

  const handleSummaryEdit = useCallback(
    (section) => {
      if (!section) return
      if (onMobileEditNavigate && isMobile && !isEditScreen) {
        onMobileEditNavigate(section)
        return
      }
      openSection(section)
    },
    [onMobileEditNavigate, isMobile, isEditScreen, openSection]
  )

  const handleAddHousehold = useCallback(() => {
    if (onMobileEditNavigate && isMobile && !isEditScreen) {
      onMobileEditNavigate('household', { householdIndex: 'new' })
      return
    }
    setNewHousehold(createHouseholdMember())
    setShowAddHouseholdModal(true)
  }, [onMobileEditNavigate, isMobile, isEditScreen])

  const handleAddAddress = useCallback(() => {
    if (onMobileEditNavigate && isMobile && !isEditScreen) {
      onMobileEditNavigate('address', { addressIndex: 'new' })
      return
    }
    setNewAddress(createAddressEntry())
    setShowAddAddressModal(true)
  }, [onMobileEditNavigate, isMobile, isEditScreen])

  const handleAddAdditionalForm = useCallback(() => {
    if (onMobileEditNavigate && isMobile && !isEditScreen) {
      onMobileEditNavigate('additional')
      return
    }
    startNewAdditionalForm()
  }, [onMobileEditNavigate, isMobile, isEditScreen])

  const saveAndContinueCurrentSection = useCallback(async () => {
    if (activeSection === 'household') return handleHouseholdSaveContinue()
    if (activeSection === 'address') return handleAddressSaveContinue()
    if (activeSection === 'additional') return handleAdditionalSaveContinue()
    return true
  }, [activeSection, handleHouseholdSaveContinue, handleAddressSaveContinue, handleAdditionalSaveContinue])

  const saveEditSectionAndNavigateBack = async () => {
    if (editSection === 'household') {
      if (showAddHouseholdModal) {
        if (!hasNonEmptyValue(newHousehold)) {
          navigateBack()
          return
        }
        const nextAdditionalHouseholds = [...additionalHouseholds, newHousehold]
        const formsPayload = buildFormsPayload({ additionalHouseholds: nextAdditionalHouseholds })
        const saveSuccess = await saveSectionWithNotification('household', formsPayload)
        if (!saveSuccess) return
        setAdditionalHouseholds(nextAdditionalHouseholds)
        setShowAddHouseholdModal(false)
        setNewHousehold(createHouseholdMember())
        setHouseholdComplete(true)
        navigateBack()
        return
      }
      const activeAdditionalIndex = typeof activeHouseholdIndex === 'number' ? activeHouseholdIndex : null
      const activePerson =
        activeAdditionalIndex === null ? namedInsured : additionalHouseholds[activeAdditionalIndex] || {}
      const hasPersonData =
        activeAdditionalIndex === null ? hasNamedInsuredData(namedInsured) : hasNonEmptyValue(activePerson)
      if (!hasPersonData) {
        navigateBack()
        return
      }
      const saveSuccess = await handleHouseholdSaveContinue(undefined, { skipNavigate: true })
      if (!saveSuccess) return
      navigateBack()
      return
    }
    if (editSection === 'address') {
      if (showAddAddressModal) {
        if (!hasNonEmptyValue(newAddress)) {
          navigateBack()
          return
        }
        const nextAdditionalAddresses = [...additionalAddresses, newAddress]
        const formsPayload = buildFormsPayload({ additionalAddresses: nextAdditionalAddresses })
        const saveSuccess = await saveSectionWithNotification('address', formsPayload)
        if (!saveSuccess) return
        setAdditionalAddresses(nextAdditionalAddresses)
        setShowAddAddressModal(false)
        setNewAddress(createAddressEntry())
        setAddressComplete(true)
        navigateBack()
        return
      }
      const activeAdditionalAddressIndex = typeof activeAddressIndex === 'number' ? activeAddressIndex : null
      const activeEntry =
        activeAdditionalAddressIndex === null
          ? { contacts, residential, mailing }
          : additionalAddresses[activeAdditionalAddressIndex] || {}
      if (!hasNonEmptyValue(activeEntry)) {
        navigateBack()
        return
      }
      const saveSuccess = await handleAddressSaveContinue(undefined, { skipNavigate: true })
      if (!saveSuccess) return
      navigateBack()
      return
    }
    if (editSection === 'additional') {
      const hasAdditionalInput =
        Boolean(additionalFormMode) ||
        Boolean(additionalFormName.trim()) ||
        Boolean(additionalFormProductId) ||
        additionalQuestions.some((question) => hasNonEmptyValue(question))
      if (!hasAdditionalInput) {
        navigateBack()
        return
      }
      const saveSuccess = await handleAdditionalFormSave({ skipNavigate: true })
      if (!saveSuccess) return
      navigateBack()
      return
    }
    navigateBack()
  }

  const handleEditBack = async (options = {}) => {
    if (!isEditScreen || options.skipAutoSave) {
      navigateBack()
      return
    }
    if (!hasUnsavedChanges()) {
      navigateBack()
      return
    }
    requestUnsavedPrompt({
      onYes: saveEditSectionAndNavigateBack,
      onNo: navigateBack,
    })
  }

  const startKeyRef = useRef(null)

  useEffect(() => {
    if (isEditScreen) return
    if (!startSection) return
    if (startKeyRef.current === startKey) return
    startKeyRef.current = startKey
    openSection(startSection)
  }, [startSection, startKey, openSection, isEditScreen])

  useEffect(() => {
    if (!editSection) return
    openSection(editSection, { pushHistory: false })
    if (editSection === 'household') {
      const index = editContext?.householdIndex ?? 'primary'
      if (index === 'new') {
        setNewHousehold(createHouseholdMember())
        setShowAddHouseholdModal(true)
      } else {
        setActiveHouseholdIndex(index)
        setHouseholdEditing(true)
      }
    }
    if (editSection === 'address') {
      const index = editContext?.addressIndex ?? 'primary'
      if (index === 'new') {
        setNewAddress(createAddressEntry())
        setShowAddAddressModal(true)
      } else {
        setActiveAddressIndex(index)
        setAddressEditing(true)
      }
    }
    if (editSection === 'additional') {
      if (typeof editContext?.additionalFormIndex === 'number') {
        editAdditionalForm(editContext.additionalFormIndex)
      } else {
        setAdditionalEditing(true)
      }
    }
  }, [editSection, editContext, openSection, editAdditionalForm])

  useEffect(() => {
    if (!additionalEditing) return
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
  const householdQuestionKeyPrefix =
    activeHouseholdIndex === 'primary' ? '' : `additional-${activeAdditionalIndex ?? activeHouseholdIndex}`
  const activeHouseholdFieldRows = buildHouseholdQuestionRows(
    activeHousehold.person,
    activeHousehold.setPerson,
    `${activeHousehold.idPrefix}-bank`,
    householdQuestionKeyPrefix
  )
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
  const activeAddressMailing =
    activeAdditionalAddressIndex === null ? mailing : activeAddressEntry.mailing
  const activeAddressCustomKeyPrefix =
    activeAdditionalAddressIndex === null ? '' : `additional-${activeAdditionalAddressIndex}`

  const buildAddressQuestionRows = (questions, customKeyPrefix) => {
    const rows = []
    const seen = new Set()
    questions.forEach((question, index) => {
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!label || !normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (normalized === addressResidentLabelKey) {
        rows.push({
          type: 'residents',
          id: `addr-bank-residents-${index}`,
          label,
          errorKey: 'residents',
        })
        return
      }

      const mapped = addressFieldLabelMap.get(normalized)
      if (mapped) {
        const fallback =
          mapped.fieldId === 'addressType'
            ? { type: 'select', options: addressTypeOptions }
            : { type: mapped.defaultType || 'text', options: undefined }
        const config = resolveQuestionConfigWithFallback(question, fallback)
        rows.push({
          type: 'field',
          id: `addr-bank-${mapped.fieldId}-${index}`,
          label,
          fieldId: mapped.fieldId,
          fieldTarget: mapped.target,
          fieldType: config.type,
          fieldOptions: config.options,
          errorKey: mapped.fieldId,
        })
        return
      }

      const customKey = buildQuestionCustomKey(customKeyPrefix, normalized)
      const config = resolveQuestionInputConfig(question?.inputType, question?.selectOptions)
      rows.push({
        type: 'custom',
        id: `addr-bank-custom-${index}`,
        label,
        customKey,
        fieldType: config.type,
        fieldOptions: config.options,
        errorKey: customKey,
      })
    })
    return rows
  }

  const addressQuestionRows = buildAddressQuestionRows(
    sectionBankQuestions.address,
    activeAddressCustomKeyPrefix
  )
  const newAddressQuestionRows = buildAddressQuestionRows(sectionBankQuestions.address, 'new')
  const showHouseholdSection = activeSection === 'household' && isSectionAllowed('household')
  const showAddressSection = activeSection === 'address' && isSectionAllowed('address')
  const showHouseholdForm =
    showHouseholdSection &&
    (!hasHouseholdData || householdEditing || isEditScreen) &&
    !showAddHouseholdModal
  const showHouseholdSummary =
    showHouseholdSection && hasHouseholdData && !householdEditing && !showAddHouseholdModal && !isEditScreen
  const showAddressForm =
    showAddressSection && (!hasAddressData || addressEditing || isEditScreen) && !showAddAddressModal
  const showAddressSummary =
    showAddressSection && hasAddressData && !addressEditing && !showAddAddressModal && !isEditScreen
  const showAdditionalSection = activeSection === 'additional' && isSectionAllowed('additional')
  const showSummarySection = activeSection === 'summary' && isSectionAllowed('summary')
  const showAdditionalForm =
    showAdditionalSection && (!hasAdditionalData || additionalEditing || isEditScreen)
  const showAdditionalSummary = showAdditionalSection && hasAdditionalData && !additionalEditing && !isEditScreen
  const progressSteps = [
    { id: 'household', label: householdSectionLabel, complete: householdComplete, allowed: isSectionAllowed('household') },
    { id: 'address', label: addressSectionLabel, complete: addressComplete, allowed: isSectionAllowed('address') },
    { id: 'additional', label: additionalSectionLabel, complete: additionalComplete, allowed: isSectionAllowed('additional') },
  ].filter((step) => step.allowed)
  const progressCompletedCount = progressSteps.filter((step) => step.complete).length
  const progressTotal = progressSteps.length
  const progressPercent = progressTotal ? Math.round((progressCompletedCount / progressTotal) * 100) : 0
  const progressSummary = progressTotal ? `${progressCompletedCount} of ${progressTotal} sections` : 'No sections available'
  const showProgressBar = showProgress && !isEditScreen
  const editSlideClass =
    isEditScreen && isMobile
      ? `transform transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          slideIn ? 'translate-x-0' : 'translate-x-full'
        }`
      : ''
  const containerPadding = isEditScreen ? 'p-4 sm:p-6' : 'p-6'
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
  const setActiveAddressField = (target, field, value) => {
    if (target === 'mailing') {
      if (activeAddressIndex === 'primary') {
        setMailing((prev) => ({ ...prev, [field]: value }))
        return
      }
      if (typeof activeAddressIndex !== 'number') return
      updateAdditionalAddress(activeAddressIndex, (prev) => ({
        ...prev,
        mailing: { ...(prev.mailing ?? { address1: '', address2: '', city: '', state: '', zip: '' }), [field]: value },
      }))
      return
    }
    if (field === 'addressType') {
      setActiveAddressType(value)
      return
    }
    setActiveAddressResidentialField(field, value)
  }
  const setNewAddressField = (target, field, value) => {
    if (target === 'mailing') {
      setNewAddress((prev) => ({
        ...prev,
        mailing: { ...(prev.mailing ?? { address1: '', address2: '', city: '', state: '', zip: '' }), [field]: value },
      }))
      return
    }
    if (field === 'addressType') {
      setNewAddress((prev) => ({
        ...prev,
        addressType: value,
        residential: { ...(prev.residential ?? {}), addressType: value },
      }))
      return
    }
    setNewAddress((prev) => ({
      ...prev,
      residential: { ...(prev.residential ?? {}), [field]: value },
    }))
  }
  const nameFieldKeys = new Set(['first-name', 'middle-initial', 'last-name', 'suffix'])
  const buildHouseholdDetails = (person, customKeyPrefix = '') => {
    const details = []
    const seen = new Set()
    sectionBankQuestions.household.forEach((question) => {
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!label || !normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (householdRelationLabelSet.has(normalized)) {
        if (hasNonEmptyValue(person?.relation)) {
          details.push({ label, value: person.relation })
        }
        return
      }

      const mappedField = householdFieldByLabel.get(normalized)
      if (mappedField) {
        if (nameFieldKeys.has(mappedField.key)) return
        const value = person?.[mappedField.key]
        if (hasNonEmptyValue(value)) {
          details.push({ label, value })
        }
        return
      }

      const customKey = buildQuestionCustomKey(customKeyPrefix, normalized)
      const value = customFieldValues?.household?.[customKey]
      if (hasNonEmptyValue(value)) {
        details.push({ label, value })
      }
    })
    return details
  }
  const buildHouseholdSummaryRows = (person, customKeyPrefix = '', limit = 4) => {
    const summary = []
    const seen = new Set()
    sectionBankQuestions.household.forEach((question) => {
      if (summary.length >= limit) return
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!label || !normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (householdRelationLabelSet.has(normalized)) {
        if (hasNonEmptyValue(person?.relation)) {
          summary.push({ label, value: person.relation })
        }
        return
      }

      const mappedField = householdFieldByLabel.get(normalized)
      if (mappedField) {
        const value = person?.[mappedField.key]
        if (hasNonEmptyValue(value)) {
          summary.push({ label, value })
        }
        return
      }

      const customKey = buildQuestionCustomKey(customKeyPrefix, normalized)
      const value = customFieldValues?.household?.[customKey]
      if (hasNonEmptyValue(value)) {
        summary.push({ label, value })
      }
    })
    return summary
  }
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
  const buildAddressDetails = (residentialEntry, mailingEntry = {}, customKeyPrefix = '', fallbackAddressType = '') => {
    const details = []
    const seen = new Set()
    sectionBankQuestions.address.forEach((question) => {
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!label || !normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (normalized === addressResidentLabelKey) {
        const residents = residentialEntry?.residents
        if (hasNonEmptyValue(residents)) {
          details.push({ label, value: formatResidentSummary(residents) })
        }
        return
      }

      const mapped = addressFieldLabelMap.get(normalized)
      if (mapped) {
        const value =
          mapped.fieldId === 'addressType'
            ? residentialEntry?.addressType ?? fallbackAddressType ?? ''
            : (mapped.target === 'mailing' ? mailingEntry : residentialEntry)?.[mapped.fieldId]
        if (hasNonEmptyValue(value)) {
          details.push({ label, value })
        }
        return
      }

      const customKey = buildQuestionCustomKey(customKeyPrefix, normalized)
      const value = customFieldValues?.address?.[customKey]
      if (hasNonEmptyValue(value)) {
        details.push({ label, value })
      }
    })
    return details
  }
  const buildAddressSummaryRows = (
    residentialEntry,
    mailingEntry = {},
    customKeyPrefix = '',
    fallbackAddressType = '',
    limit = 4
  ) => {
    const summary = []
    const seen = new Set()
    sectionBankQuestions.address.forEach((question) => {
      if (summary.length >= limit) return
      const label = (question?.text || '').toString().trim()
      const normalized = normalizeQuestionText(label)
      if (!label || !normalized || seen.has(normalized)) return
      seen.add(normalized)

      if (normalized === addressResidentLabelKey) {
        const residents = residentialEntry?.residents
        if (hasNonEmptyValue(residents)) {
          summary.push({ label, value: formatResidentSummary(residents) })
        }
        return
      }

      const mapped = addressFieldLabelMap.get(normalized)
      if (mapped) {
        const value =
          mapped.fieldId === 'addressType'
            ? residentialEntry?.addressType ?? fallbackAddressType ?? ''
            : (mapped.target === 'mailing' ? mailingEntry : residentialEntry)?.[mapped.fieldId]
        if (hasNonEmptyValue(value)) {
          summary.push({ label, value })
        }
        return
      }

      const customKey = buildQuestionCustomKey(customKeyPrefix, normalized)
      const value = customFieldValues?.address?.[customKey]
      if (hasNonEmptyValue(value)) {
        summary.push({ label, value })
      }
    })
    return summary
  }
  const summaryValue = (value) => (value ? value : '-')
  const primarySummaryRows = buildHouseholdSummaryRows(namedInsured, '', 4)
  const primaryAddressSummaryRows = buildAddressSummaryRows(residential, mailing, '', residential?.addressType ?? '', 4)
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
    const nextNamedInsured = overrides.namedInsured ?? namedInsured
    const nextAdditionalHouseholds = overrides.additionalHouseholds ?? additionalHouseholds
    const nextContacts = overrides.contacts ?? contacts
    const nextResidential = overrides.residential ?? residential
    const nextMailing = overrides.mailing ?? mailing
    const nextAdditionalAddresses = overrides.additionalAddresses ?? additionalAddresses
    const nextAdditionalForms = overrides.additionalForms ?? additionalForms
    const nextCustomFields = overrides.customFields ?? customFieldValues
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
        namedInsured: nextNamedInsured,
        additionalHouseholds: nextAdditionalHouseholds,
      },
      address: {
        contacts: nextContacts,
        residential: nextResidential,
        mailing: nextMailing,
        additionalAddresses: nextAdditionalAddresses,
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
      customFields: nextCustomFields,
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
  const resolveSectionName = useCallback(
    (sectionKey) => {
      if (!sectionKey) return ''
      if (sectionKey === 'household') return householdSectionName
      if (sectionKey === 'address') return addressSectionName
      if (sectionKey === 'additional') return additionalSectionName
      if (sectionKey === 'summary') return 'Summary'
      return sectionKey
    },
    [householdSectionName, addressSectionName, additionalSectionName]
  )

  const hasUnsavedChanges = useCallback(() => {
    if (showAddHouseholdModal && hasNonEmptyValue(newHousehold)) return true
    if (showAddAddressModal && hasNonEmptyValue(newAddress)) return true
    if (additionalEditing) {
      const hasAdditionalInput =
        Boolean(additionalFormMode) ||
        Boolean(additionalFormName.trim()) ||
        Boolean(additionalFormProductId) ||
        additionalQuestions.some((question) => hasNonEmptyValue(question))
      if (hasAdditionalInput) return true
    }
    const payload = formsPayloadRef.current || buildFormsPayload()
    const serialized = serializeForms(payload)
    const lastSaved = lastSavedSerializedRef.current
    return lastSaved !== null && serialized !== lastSaved
  }, [
    showAddHouseholdModal,
    newHousehold,
    showAddAddressModal,
    newAddress,
    additionalEditing,
    additionalFormMode,
    additionalFormName,
    additionalFormProductId,
    additionalQuestions,
    buildFormsPayload,
    serializeForms,
  ])

  const openUnsavedPrompt = useCallback(
    ({ onYes, onNo }) => {
      setUnsavedPrompt((prev) => {
        if (prev.open) return prev
        return { open: true, saving: false, onYes, onNo }
      })
    },
    [setUnsavedPrompt]
  )

  const requestUnsavedPrompt = useCallback(
    ({ onYes, onNo }) => {
      if (!hasUnsavedChanges()) {
        if (typeof onNo === 'function') onNo()
        return
      }
      openUnsavedPrompt({ onYes, onNo })
    },
    [hasUnsavedChanges, openUnsavedPrompt]
  )

  const closeUnsavedPrompt = useCallback(() => {
    setUnsavedPrompt({ open: false, saving: false, onYes: null, onNo: null })
  }, [])

  const cloneFormsPayload = useCallback((payload) => {
    if (!payload) return payload
    if (typeof structuredClone === 'function') {
      return structuredClone(payload)
    }
    return JSON.parse(JSON.stringify(payload))
  }, [])

  const applyFormsSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) return
      const household = snapshot.household || {}
      const address = snapshot.address || {}
      const additional = snapshot.additional || {}
      const customFields = snapshot.customFields || {}
      setNamedInsured((prev) => ({
        ...prev,
        ...(household.namedInsured || {}),
        relation: household.namedInsured?.relation || prev.relation || defaultApplicantRelation,
      }))
      setAdditionalHouseholds(Array.isArray(household.additionalHouseholds) ? household.additionalHouseholds : [])
      const nextContacts =
        Array.isArray(address.contacts) && address.contacts.length ? address.contacts : [createContact()]
      setContacts(nextContacts)
      setResidential(address.residential || { address1: '', city: '', state: '', zip: '' })
      setMailing(address.mailing || { address1: '', city: '', state: '', zip: '' })
      setAdditionalAddresses(Array.isArray(address.additionalAddresses) ? address.additionalAddresses : [])
      setAdditionalForms(Array.isArray(additional.additionalForms) ? additional.additionalForms : [])
      setCustomFieldValues({
        household: customFields.household || {},
        address: customFields.address || {},
        additional: customFields.additional || {},
      })
      setHouseholdErrors({})
      setAddressErrors({})
      setAdditionalErrors({})
      setShowAddHouseholdModal(false)
      setShowAddAddressModal(false)
      setNewHousehold(createHouseholdMember())
      setNewAddress(createAddressEntry())
    },
    [createAddressEntry, createContact, createHouseholdMember]
  )

  const discardUnsavedChanges = useCallback(() => {
    const snapshot = lastSavedFormsRef.current
    if (!snapshot) return
    const cloned = cloneFormsPayload(snapshot)
    applyFormsSnapshot(cloned)
    formsPayloadRef.current = cloned
    lastSavedSerializedRef.current = serializeForms(snapshot)
    if (typeof onFormDataChange === 'function') {
      onFormDataChange(cloned)
    }
  }, [applyFormsSnapshot, cloneFormsPayload, serializeForms, onFormDataChange])

  const handleUnsavedNo = useCallback(() => {
    discardUnsavedChanges()
    const onNo = unsavedPrompt.onNo
    closeUnsavedPrompt()
    if (typeof onNo === 'function') onNo()
  }, [unsavedPrompt.onNo, closeUnsavedPrompt, discardUnsavedChanges])

  const handleUnsavedYes = useCallback(async () => {
    const onYes = unsavedPrompt.onYes
    if (typeof onYes !== 'function') {
      closeUnsavedPrompt()
      return
    }
    setUnsavedPrompt((prev) => ({ ...prev, saving: true }))
    const result = await onYes()
    if (result === false) {
      setUnsavedPrompt((prev) => ({ ...prev, saving: false }))
      return
    }
    closeUnsavedPrompt()
  }, [unsavedPrompt.onYes, closeUnsavedPrompt])

  useEffect(() => {
    const handlePopState = (event) => {
      const section = event.state?.clientFormSection
      if (!section) return
      if (!hasUnsavedChanges()) {
        openSection(section, { pushHistory: false })
        return
      }
      if (typeof window !== 'undefined') {
        const currentSection = sectionHistoryRef.current || activeSection || section
        window.history.pushState({ clientFormSection: currentSection }, '')
        sectionHistoryRef.current = currentSection
      }
      requestUnsavedPrompt({
        onYes: saveAndContinueCurrentSection,
        onNo: () => {
          openSection(section, { pushHistory: false })
          if (typeof window !== 'undefined') {
            window.history.replaceState({ clientFormSection: section }, '')
            sectionHistoryRef.current = section
          }
        },
      })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [openSection, hasUnsavedChanges, requestUnsavedPrompt, saveAndContinueCurrentSection, activeSection])

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
      lastSavedFormsRef.current = cloneFormsPayload(payload)
      return serialized
    },
    [serializeForms, showNotification, cloneFormsPayload]
  )

  const saveSectionWithNotification = useCallback(
    async (sectionKey, formsOverride) => {
      if (typeof onSectionSave !== 'function') return true
      const resolvedSection = resolveSectionName(sectionKey)
      if (!resolvedSection) return true
      const formsPayload = formsOverride || buildFormsPayload()
      formsPayloadRef.current = formsPayload
      const saveResult = await onSectionSave({
        section: resolvedSection,
        nextSection: resolvedSection,
        forms: formsPayload,
        logClick: false,
      })
      if (!saveResult?.success) return false
      notifySaveIfChanged(formsPayload)
      showNotification('Changes saved.')
      return true
    },
    [onSectionSave, resolveSectionName, buildFormsPayload, notifySaveIfChanged, showNotification]
  )


  useEffect(() => {
    if (!hydrated) return
    const formsPayload = buildFormsPayload()
    formsPayloadRef.current = formsPayload
    if (lastSavedSerializedRef.current === null) {
      lastSavedSerializedRef.current = serializeForms(formsPayload)
      lastSavedFormsRef.current = cloneFormsPayload(formsPayload)
    }
    if (typeof onFormDataChange === 'function') {
      onFormDataChange(formsPayload)
    }
    if (typeof onShareSnapshotChange !== 'function') return
    const buildSharePerson = (person, label, customKeyPrefix = '') => ({
      label,
      fullName: buildFullName(person || {}),
      dob: person?.dob || '',
      gender: person?.gender || '',
      details: buildHouseholdDetails(person || {}, customKeyPrefix),
    })
    const primarySnapshot = buildSharePerson(
      namedInsured,
      namedInsured.relation ? namedInsured.relation : 'Primary Applicant',
      ''
    )
    const additionalHouseholdSnapshots = additionalHouseholds
      .filter((person) => hasNonEmptyValue(person))
      .map((person, index) =>
        buildSharePerson(person, person?.relation || 'Additional Household Member', `additional-${index}`)
      )
    const primaryContactSnapshot = contacts[0] || createContact()
    const primaryAddressSnapshot = {
      label: primaryAddressLabel,
      street1: residential?.address1 || '',
      details: buildAddressDetails(residential, mailing, '', residential?.addressType ?? ''),
    }
    const additionalAddressSnapshots = additionalAddresses
      .filter((entry) => hasNonEmptyValue(entry))
      .map((entry, index) => ({
        label: getAdditionalAddressLabel(entry, index),
        street1: entry?.residential?.address1 || '',
        details: buildAddressDetails(
          entry?.residential,
          entry?.mailing,
          `additional-${index}`,
          entry?.addressType ?? entry?.residential?.addressType ?? ''
        ),
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
    <main className={`min-h-full ${isEditScreen && isMobile ? 'overflow-hidden' : ''}`}>
      <div className={`min-h-full w-full border border-slate-300 bg-white ${containerPadding} ${editSlideClass}`}>
        <Modal title="Save changes?" open={unsavedPrompt.open} onClose={handleUnsavedNo} showClose={false} panelClassName="max-w-sm">
          <div className="text-sm text-slate-700">Do you want to save your changes?</div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className={miniButton} onClick={handleUnsavedNo} disabled={unsavedPrompt.saving}>
              No
            </button>
            <button type="button" className={nextButton} onClick={handleUnsavedYes} disabled={unsavedPrompt.saving}>
              {unsavedPrompt.saving ? 'Saving...' : 'Yes'}
            </button>
          </div>
        </Modal>
        {notification && (
          <div className="sticky top-0 z-20 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="font-semibold">{notification.message}</div>
          </div>
        )}
        {isEditScreen ? (
          <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-3">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 shadow-sm"
              onClick={handleEditBack}
              aria-label="Go back"
            >
              &lt;
            </button>
            <div className="text-sm font-semibold text-slate-900">{editSectionLabel}</div>
          </div>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
            Create your insurance passport
          </div>
        )}
        {showProgressBar && (
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
        {!isEditScreen && (
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
        )}

        {showHouseholdSection && (
          <>
            {householdQuestionsUnavailable ? (
              <section className="mt-6 flex justify-center">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  {householdQuestionsError}
                </div>
              </section>
            ) : (
              <>
            {showAddHouseholdModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Household Member</div>
                    <div className={gridClass}>
                      {newHouseholdFields.map((field) => (
                        <div key={field.id} className="contents">
                          <FieldRow {...field} />
                          {field.errorKey && householdErrors[field.errorKey] && (
                            <div className="col-span-2 text-xs text-rose-600">
                              {householdErrors[field.errorKey]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (isEditScreen) {
                            handleEditBack()
                            return
                          }
                          requestUnsavedPrompt({
                            onYes: async () => {
                              const nextAdditionalHouseholds = [...additionalHouseholds, newHousehold]
                              const formsPayload = buildFormsPayload({
                                additionalHouseholds: nextAdditionalHouseholds,
                              })
                              const saveSuccess = await saveSectionWithNotification('household', formsPayload)
                              if (!saveSuccess) return false
                              setAdditionalHouseholds(nextAdditionalHouseholds)
                              setShowAddHouseholdModal(false)
                              setNewHousehold(createHouseholdMember())
                              setHouseholdComplete(true)
                              setActiveHouseholdIndex('primary')
                              setHouseholdEditing(false)
                              return true
                            },
                            onNo: () => {
                              setShowAddHouseholdModal(false)
                              setNewHousehold(createHouseholdMember())
                            },
                          })
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={async () => {
                          const nextAdditionalHouseholds = [...additionalHouseholds, newHousehold]
                          setAdditionalHouseholds(nextAdditionalHouseholds)
                          setShowAddHouseholdModal(false)
                          setNewHousehold(createHouseholdMember())
                          setHouseholdComplete(true)
                          if (isEditScreen) {
                            const formsPayload = buildFormsPayload({ additionalHouseholds: nextAdditionalHouseholds })
                            await handleHouseholdSaveContinue(formsPayload)
                            return
                          }
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
                <form className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">{householdSectionLabel}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeHousehold.label}</div>
                      <div className={`mt-3 ${gridClass}`}>
                        {activeHouseholdFieldRows.map((field) => (
                          <div key={field.id} className="contents">
                            <FieldRow {...field} />
                            {field.errorKey && householdErrors[field.errorKey] && (
                              <div className="col-span-2 text-xs text-rose-600">
                                {householdErrors[field.errorKey]}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (isEditScreen) {
                            handleEditBack()
                            return
                          }
                          requestUnsavedPrompt({
                            onYes: async () => handleHouseholdSaveContinue(),
                            onNo: () => {
                              if (householdComplete) {
                                setHouseholdEditing(false)
                              } else {
                                setActiveSection(null)
                              }
                            },
                          })
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
                        onClick={() => handleEditSection('household', { householdIndex: 'primary' })}
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
                    const summaryRows = buildHouseholdSummaryRows(person, `additional-${index}`, 4)
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
                              onClick={() => handleEditSection('household', { householdIndex: index })}
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
                      onClick={handleAddHousehold}
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
          </>
        )}
        {showAddressSection && (
          <>
            {addressQuestionsUnavailable ? (
              <section className="mt-6 flex justify-center">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  {addressQuestionsError}
                </div>
              </section>
            ) : null}
            {!addressQuestionsUnavailable && (
              <>
            {showAddAddressModal && (
              <section className="mt-6 flex justify-center">
                <form className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">Additional Address</div>
                    <div className={`mt-3 ${gridClass}`}>
                      {newAddressQuestionRows.map((row) => {
                        if (row.type === 'residents') {
                          return (
                            <div key={row.id} className="contents">
                              <label htmlFor="new-address-residents" className={labelClass}>
                                {row.label}
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
                          )
                        }

                        if (row.type === 'custom') {
                          const value = customFieldValues?.address?.[row.customKey] ?? ''
                          return (
                            <div key={row.id} className="contents">
                              <FieldRow
                                id={row.id}
                                label={row.label}
                                type={row.fieldType}
                                options={row.fieldOptions}
                                value={value}
                                onChange={(event) => setCustomFieldValue('address', row.customKey, event.target.value)}
                              />
                              {row.errorKey && addressErrors[row.errorKey] && (
                                <div className="col-span-2 text-xs text-rose-600">
                                  {addressErrors[row.errorKey]}
                                </div>
                              )}
                            </div>
                          )
                        }

                        const value =
                          row.fieldTarget === 'mailing'
                            ? newAddress.mailing?.[row.fieldId] ?? ''
                            : row.fieldId === 'addressType'
                              ? newAddress.residential?.addressType ?? newAddress.addressType ?? ''
                              : newAddress.residential?.[row.fieldId] ?? ''
                        return (
                          <div key={row.id} className="contents">
                            <FieldRow
                              id={row.id}
                              label={row.label}
                              type={row.fieldType}
                              options={row.fieldOptions}
                              placeholder={row.fieldId === 'addressType' ? 'Select address type' : undefined}
                              value={value}
                              onChange={(event) => setNewAddressField(row.fieldTarget, row.fieldId, event.target.value)}
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        className={miniButton}
                        onClick={() => {
                          if (isEditScreen) {
                            handleEditBack()
                            return
                          }
                          requestUnsavedPrompt({
                            onYes: async () => {
                              const nextAdditionalAddresses = [...additionalAddresses, newAddress]
                              const formsPayload = buildFormsPayload({
                                additionalAddresses: nextAdditionalAddresses,
                              })
                              const saveSuccess = await saveSectionWithNotification('address', formsPayload)
                              if (!saveSuccess) return false
                              setAdditionalAddresses(nextAdditionalAddresses)
                              setShowAddAddressModal(false)
                              setNewAddress(createAddressEntry())
                              setAddressComplete(true)
                              setActiveAddressIndex('primary')
                              setAddressEditing(false)
                              return true
                            },
                            onNo: () => {
                              setShowAddAddressModal(false)
                              setNewAddress(createAddressEntry())
                            },
                          })
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={async () => {
                          const nextAdditionalAddresses = [...additionalAddresses, newAddress]
                          setAdditionalAddresses(nextAdditionalAddresses)
                          setShowAddAddressModal(false)
                          setNewAddress(createAddressEntry())
                          setAddressComplete(true)
                          if (isEditScreen) {
                            const formsPayload = buildFormsPayload({ additionalAddresses: nextAdditionalAddresses })
                            await handleAddressSaveContinue(formsPayload)
                            return
                          }
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
                <form className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
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

                          if (row.type === 'custom') {
                            const value = customFieldValues?.address?.[row.customKey] ?? ''
                            return (
                              <div key={row.id} className="contents">
                                <FieldRow
                                  id={row.id}
                                  label={row.label}
                                  type={row.fieldType}
                                  options={row.fieldOptions}
                                  value={value}
                                  onChange={(event) => setCustomFieldValue('address', row.customKey, event.target.value)}
                                />
                                {row.errorKey && addressErrors[row.errorKey] && (
                                  <div className="col-span-2 text-xs text-rose-600">
                                    {addressErrors[row.errorKey]}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          const value =
                            row.fieldTarget === 'mailing'
                              ? activeAddressMailing?.[row.fieldId] ?? ''
                              : row.fieldId === 'addressType'
                                ? activeAddressType
                                : activeAddressResidential?.[row.fieldId] ?? ''
                          return (
                            <div key={row.id} className="contents">
                              <FieldRow
                                id={row.id}
                                label={row.label}
                                type={row.fieldType}
                                options={row.fieldOptions}
                                placeholder={row.fieldId === 'addressType' ? 'Select address type' : undefined}
                                value={value}
                                onChange={(event) => setActiveAddressField(row.fieldTarget, row.fieldId, event.target.value)}
                              />
                              {row.errorKey && addressErrors[row.errorKey] && (
                                <div className="col-span-2 text-xs text-rose-600">
                                  {addressErrors[row.errorKey]}
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
                          if (isEditScreen) {
                            handleEditBack()
                            return
                          }
                          requestUnsavedPrompt({
                            onYes: async () => handleAddressSaveContinue(),
                            onNo: () => {
                              if (addressComplete) {
                                setAddressEditing(false)
                              } else {
                                setActiveSection(null)
                              }
                            },
                          })
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
                        onClick={() => handleEditSection('address', { addressIndex: 'primary' })}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                      {primaryAddressSummaryRows.length ? (
                        primaryAddressSummaryRows.map((item, index) => (
                          <div key={`primary-address-summary-${index}`}>
                            <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                            {summaryValue(item.value)}
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500">No address details added.</div>
                      )}
                    </div>
                  </div>

                  {additionalAddresses.map((address, index) => {
                    const summaryRows = buildAddressSummaryRows(
                      address?.residential,
                      address?.mailing,
                      `additional-${index}`,
                      address?.addressType ?? address?.residential?.addressType ?? '',
                      4
                    )
                    return (
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
                              onClick={() => handleEditSection('address', { addressIndex: index })}
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
                          {summaryRows.length ? (
                            summaryRows.map((item, idx) => (
                              <div key={`additional-address-summary-${index}-${idx}`}>
                                <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                {summaryValue(item.value)}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-500">No address details added.</div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      className={miniButton}
                      onClick={handleAddAddress}
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
          </>
        )}

        {showAdditionalSection && (
          <>
            {showAdditionalForm && (
              <section className="mt-6 flex justify-center">
                <form className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
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
                                  (() => {
                                    const config = resolveQuestionInputConfig(
                                      question?.inputType,
                                      question?.selectOptions
                                    )
                                    if (config.type === 'select') {
                                      return (
                                        <select
                                          className={inputClass}
                                          value={question.input}
                                          onChange={(event) =>
                                            updateAdditionalQuestion(index, 'input', event.target.value)
                                          }
                                        >
                                          <option value="">- Select -</option>
                                          {(config.options || []).map((option) => (
                                            <option key={`${option}-${index}`} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      )
                                    }
                                    return (
                                      <input
                                        className={inputClass}
                                        placeholder="Answer"
                                        aria-label="Answer"
                                        type={config.type || 'text'}
                                        value={question.input}
                                        onChange={(event) => updateAdditionalQuestion(index, 'input', event.target.value)}
                                      />
                                    )
                                  })()
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
                          if (isEditScreen) {
                            handleEditBack()
                            return
                          }
                          requestUnsavedPrompt({
                            onYes: async () => handleAdditionalFormSave(),
                            onNo: () => {
                              if (additionalComplete) {
                                setAdditionalEditing(false)
                              } else {
                                setActiveSection(null)
                              }
                            },
                          })
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={nextButton}
                        onClick={handleAdditionalFormSave}
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
                            <button
                              type="button"
                              className={miniButton}
                              onClick={() => handleEditSection('additional', { additionalFormIndex: index })}
                            >
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
                    <button type="button" className={miniButton} onClick={handleAddAdditionalForm}>
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
                  <button type="button" className={miniButton} onClick={() => handleSummaryEdit('household')}>
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
                  <button type="button" className={miniButton} onClick={() => handleSummaryEdit('address')}>
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                  {primaryAddressSummaryRows.length ? (
                    primaryAddressSummaryRows.map((item, index) => (
                      <div key={`summary-address-${index}`}>
                        <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                        {summaryValue(item.value)}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500">No address details added.</div>
                  )}
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
                  <button type="button" className={miniButton} onClick={() => handleSummaryEdit('additional')}>
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
