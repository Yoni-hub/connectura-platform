import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { API_URL } from '../services/api'
import { adminApi, clearAdminToken, setAdminToken } from '../services/adminApi'
import { renderSiteContent } from '../utils/siteContent'

const CREATE_PROFILE_SECTION_KEYS = ['household', 'address', 'additional']

const filterCreateProfileSchema = (schema) => {
  if (!schema?.sections) return schema
  const nextSections = CREATE_PROFILE_SECTION_KEYS.reduce((acc, key) => {
    if (schema.sections[key]) acc[key] = schema.sections[key]
    return acc
  }, {})
  return { ...schema, sections: nextSections }
}

export default function Admin() {
  const [admin, setAdmin] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [view, setView] = useState('agents')
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState([])
  const [clients, setClients] = useState([])
  const [logs, setLogs] = useState([])
  const [auditMode, setAuditMode] = useState('client')
  const [auditQuery, setAuditQuery] = useState('')
  const [auditStart, setAuditStart] = useState('')
  const [auditEnd, setAuditEnd] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditSearched, setAuditSearched] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [detailTabs, setDetailTabs] = useState([])
  const [activeDetailKey, setActiveDetailKey] = useState(null)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpResult, setOtpResult] = useState(null)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [contentEntries, setContentEntries] = useState([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [activeContentSlug, setActiveContentSlug] = useState('about_public')
  const [contentWarnings, setContentWarnings] = useState([])
  const [formSchema, setFormSchema] = useState(null)
  const [formSchemaLoading, setFormSchemaLoading] = useState(false)
  const [formSchemaSaving, setFormSchemaSaving] = useState(false)
  const [activeFormSection, setActiveFormSection] = useState('household')
  const [formsTab, setFormsTab] = useState('schema')
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [activeProductId, setActiveProductId] = useState('')
  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [questionSourceFilter, setQuestionSourceFilter] = useState('all')
  const [questionEdits, setQuestionEdits] = useState({})
  const [newProductName, setNewProductName] = useState('')
  const lastQuestionPrefillProductRef = useRef('')
  const auditSearchTimerRef = useRef(null)
  const auditRequestIdRef = useRef(0)

  const isAuthed = Boolean(admin)

  useEffect(() => {
    let active = true
    const checkSession = async () => {
      try {
        const res = await adminApi.get('/admin/me')
        if (!active) return
        setAdmin(res.data.admin)
      } catch {
        if (!active) return
        setAdmin(null)
      } finally {
        if (active) setAuthChecking(false)
      }
    }
    checkSession()
    return () => {
      active = false
    }
  }, [])

  const splitList = (value = '') =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

  const joinList = (value = []) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : '')

  const contentPages = [
    { slug: 'about_public', label: 'About Us (Public)' },
    { slug: 'privacy_policy', label: 'Privacy Policy' },
    { slug: 'legal_notice', label: 'Legal Notice' },
    { slug: 'careers_intro', label: 'Careers Intro' },
    { slug: 'contact_intro', label: 'Contact Page Intro' },
  ]

  const activeDetailTab =
    detailTabs.find((t) => t.key === activeDetailKey) || (detailTabs.length ? detailTabs[detailTabs.length - 1] : null)

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      if (data?.token) {
        setAdminToken(data.token)
      }
      setAdmin(data.admin)
      setAuthChecking(false)
      toast.success('Admin logged in')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const handleLogout = () => {
    adminApi.post('/admin/logout').catch(() => {})
    clearAdminToken()
    setAdmin(null)
    setAgents([])
    setClients([])
    setLogs([])
    setDetailTabs([])
    setActiveDetailKey(null)
    setOtpEmail('')
    setOtpResult(null)
    setOtpError('')
    setContentEntries([])
    setContentWarnings([])
    setActiveContentSlug('about_public')
    setFormSchema(null)
    setActiveFormSection('household')
    setFormsTab('schema')
    setProducts([])
    setActiveProductId('')
    setQuestions([])
    setNewQuestion('')
    setQuestionSourceFilter('all')
    setQuestionEdits({})
    setNewProductName('')
  }

  const upsertTab = (tab) => {
    setDetailTabs((prev) => {
      const existing = prev.find((t) => t.key === tab.key)
      if (existing) {
        return prev.map((t) => (t.key === tab.key ? { ...t, ...tab } : t))
      }
      return [...prev, tab]
    })
    setActiveDetailKey(tab.key)
  }

  const patchTab = (key, patch) =>
    setDetailTabs((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  const patchTabForm = (key, patch) =>
    setDetailTabs((prev) =>
      prev.map((t) => (t.key === key ? { ...t, form: { ...(t.form || {}), ...patch } } : t))
    )

  const openAgentTab = async (agent) => {
    const key = `agent-${agent.id}`
    upsertTab({
      key,
      type: 'agent',
      id: agent.id,
      label: agent.name || `Agent #${agent.id}`,
      loading: true,
      saving: false,
      form: null,
      data: null,
    })
    try {
      const res = await adminApi.get(`/admin/agents/${agent.id}`)
      const detail = res.data.agent
      patchTab(key, {
        loading: false,
        data: detail,
        label: detail.name || `Agent #${agent.id}`,
        form: {
          name: detail.name || '',
          email: detail.email || '',
          password: detail.userPassword || '',
          bio: detail.bio || '',
          phone: detail.phone || '',
          address: detail.address || '',
          zip: detail.zip || '',
          availability: detail.availability || 'online',
          languages: joinList(detail.languages),
          states: joinList(detail.states),
          products: joinList(detail.products),
          appointedCarriers: joinList(detail.appointedCarriers),
          specialty: detail.specialty || '',
          producerNumber: detail.producerNumber || '',
          status: detail.status || 'pending',
          underReview: Boolean(detail.underReview),
          isSuspended: Boolean(detail.isSuspended),
          rating: detail.rating ?? '',
        },
      })
    } catch {
      toast.error('Failed to load agent details')
      patchTab(key, { loading: false })
    }
  }

  const openClientTab = async (client) => {
    const key = `client-${client.id}`
    upsertTab({
      key,
      type: 'client',
      id: client.id,
      label: client.name || `Client #${client.id}`,
      loading: true,
      saving: false,
      form: null,
      data: null,
    })
    try {
      const res = await adminApi.get(`/admin/clients/${client.id}`)
      const detail = res.data.client
      patchTab(key, {
        loading: false,
        data: detail,
        label: detail.name || `Client #${client.id}`,
        form: {
          name: detail.name || '',
          email: detail.email || '',
          password: detail.userPassword || '',
          preferredLangs: joinList(detail.preferredLangs),
          coverages: joinList(detail.coverages),
          priorInsurance: joinList(detail.priorInsurance),
          profileData: JSON.stringify(detail.profileData || {}, null, 2),
          isDisabled: Boolean(detail.isDisabled),
        },
      })
    } catch {
      toast.error('Failed to load client details')
      patchTab(key, { loading: false })
    }
  }

  const saveAgentTab = async (tab) => {
    const payload = {
      name: tab.form.name,
      email: tab.form.email,
      password: tab.form.password,
      bio: tab.form.bio,
      phone: tab.form.phone,
      address: tab.form.address,
      zip: tab.form.zip,
      availability: tab.form.availability,
      specialty: tab.form.specialty,
      producerNumber: tab.form.producerNumber,
      languages: splitList(tab.form.languages),
      states: splitList(tab.form.states),
      products: splitList(tab.form.products),
      appointedCarriers: splitList(tab.form.appointedCarriers),
      status: tab.form.status,
      underReview: Boolean(tab.form.underReview),
      isSuspended: Boolean(tab.form.isSuspended),
    }
    if (tab.form.rating !== '' && tab.form.rating !== null && tab.form.rating !== undefined) {
      const ratingNumber = Number(tab.form.rating)
      if (!Number.isNaN(ratingNumber)) payload.rating = ratingNumber
    }
    patchTab(tab.key, { saving: true })
    try {
      const res = await adminApi.put(`/admin/agents/${tab.id}`, payload)
      const updated = res.data.agent
      patchTab(tab.key, {
        saving: false,
        data: updated,
        label: updated.name || tab.label,
        form: {
          ...tab.form,
          name: updated.name || '',
          email: updated.email || '',
          password: updated.userPassword || tab.form.password,
          bio: updated.bio || '',
          phone: updated.phone || '',
          address: updated.address || '',
          zip: updated.zip || '',
          availability: updated.availability || 'online',
          languages: joinList(updated.languages),
          states: joinList(updated.states),
          products: joinList(updated.products),
          appointedCarriers: joinList(updated.appointedCarriers),
          specialty: updated.specialty || '',
          producerNumber: updated.producerNumber || '',
          status: updated.status || 'pending',
          underReview: Boolean(updated.underReview),
          isSuspended: Boolean(updated.isSuspended),
          rating: updated.rating ?? '',
        },
      })
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))
      toast.success('Agent saved')
    } catch (err) {
      patchTab(tab.key, { saving: false })
      toast.error(err.response?.data?.error || 'Save failed')
    }
  }

  const saveClientTab = async (tab) => {
    let profileDataParsed = {}
    try {
      profileDataParsed = tab.form.profileData ? JSON.parse(tab.form.profileData) : {}
    } catch {
      toast.error('Profile data must be valid JSON')
      return
    }
    const payload = {
      name: tab.form.name,
      email: tab.form.email,
      password: tab.form.password,
      preferredLangs: splitList(tab.form.preferredLangs),
      coverages: splitList(tab.form.coverages),
      priorInsurance: splitList(tab.form.priorInsurance),
      profileData: profileDataParsed,
      isDisabled: Boolean(tab.form.isDisabled),
    }
    patchTab(tab.key, { saving: true })
    try {
      const res = await adminApi.put(`/admin/clients/${tab.id}`, payload)
      const updated = res.data.client
      patchTab(tab.key, {
        saving: false,
        data: updated,
        label: updated.name || tab.label,
        form: {
          ...tab.form,
          name: updated.name || '',
          email: updated.email || '',
          password: updated.userPassword || tab.form.password,
          preferredLangs: joinList(updated.preferredLangs),
          coverages: joinList(updated.coverages),
          priorInsurance: joinList(updated.priorInsurance),
          profileData: JSON.stringify(updated.profileData || {}, null, 2),
          isDisabled: Boolean(updated.isDisabled),
        },
      })
      setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      toast.success('Client saved')
    } catch (err) {
      patchTab(tab.key, { saving: false })
      toast.error(err.response?.data?.error || 'Save failed')
    }
  }


  const closeTab = (key) => {
    setDetailTabs((prev) => {
      const next = prev.filter((t) => t.key !== key)
      if (activeDetailKey === key) {
        setActiveDetailKey(next.length ? next[next.length - 1].key : null)
      }
      return next
    })
  }

  useEffect(() => {
    const load = async () => {
      if (!isAuthed) return
      setLoading(true)
      try {
        if (view === 'agents') {
          const res = await adminApi.get('/admin/agents')
          setAgents(res.data.agents || [])
        } else if (view === 'clients') {
          const res = await adminApi.get('/admin/clients')
          setClients(res.data.clients || [])
        } else if (view === 'audit') {
          setLogs([])
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout()
          toast.error('Session expired')
        } else {
          toast.error('Failed to load data')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAuthed, view])

  useEffect(() => {
    if (!isAuthed || view !== 'content') return
    loadContentEntries()
  }, [isAuthed, view])

  useEffect(() => {
    if (view !== 'audit') return
    setAuditMode('client')
    setAuditQuery('')
    setAuditStart('')
    setAuditEnd('')
    setAuditError('')
    setAuditSearched(false)
    setLogs([])
  }, [view])

  useEffect(() => {
    if (view !== 'audit') return
    if (auditMode === 'admin') return
    const trimmed = auditQuery.trim()
    if (!trimmed) {
      if (auditSearchTimerRef.current) {
        clearTimeout(auditSearchTimerRef.current)
      }
      setAuditSearched(false)
      setAuditError('')
      setLogs([])
      return
    }
    if (auditSearchTimerRef.current) {
      clearTimeout(auditSearchTimerRef.current)
    }
    auditSearchTimerRef.current = setTimeout(() => {
      handleAuditSearch()
    }, 400)
    return () => {
      if (auditSearchTimerRef.current) {
        clearTimeout(auditSearchTimerRef.current)
      }
    }
  }, [auditQuery, auditStart, auditEnd, auditMode, view])

  useEffect(() => {
    if (!isAuthed || view !== 'forms') return
    loadFormSchema()
    loadProducts()
  }, [isAuthed, view])

  useEffect(() => {
    if (!isAuthed || view !== 'forms' || formsTab !== 'questions') return
    loadQuestions(activeProductId, questionSourceFilter)
  }, [isAuthed, view, formsTab, activeProductId, questionSourceFilter])

  useEffect(() => {
    if (!contentEntries.length) return
    const exists = contentEntries.some((entry) => entry.slug === activeContentSlug)
    if (!exists) {
      setActiveContentSlug(contentEntries[0].slug)
    }
  }, [contentEntries, activeContentSlug])

  const doAgentAction = async (id, action) => {
    try {
      await adminApi.post(`/admin/agents/${id}/${action}`)
      toast.success(`Agent ${action}`)
      const res = await adminApi.get('/admin/agents')
      setAgents(res.data.agents || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  const doAgentDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/agents/${id}`)
      toast.success('Agent deleted')
      setAgents((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const doClientAction = async (id, action) => {
    try {
      await adminApi.post(`/admin/clients/${id}/${action}`)
      toast.success(`Client ${action}`)
      const res = await adminApi.get('/admin/clients')
      setClients(res.data.clients || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  const doClientDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/clients/${id}`)
      toast.success('Client deleted')
      setClients((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const toIsoDate = (value) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toISOString()
  }

  const handleAuditSearch = async () => {
    setAuditError('')
    if ((auditMode === 'client' || auditMode === 'agent') && !auditQuery.trim()) {
      setAuditError('Enter a name, email, or ID to search.')
      setLogs([])
      setAuditSearched(false)
      return
    }
    const startIso = toIsoDate(auditStart)
    const endIso = toIsoDate(auditEnd)
    if (auditStart && !startIso) {
      setAuditError('Start date is invalid.')
      setLogs([])
      setAuditSearched(false)
      return
    }
    if (auditEnd && !endIso) {
      setAuditError('End date is invalid.')
      setLogs([])
      setAuditSearched(false)
      return
    }
    if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
      setAuditError('End date must be after the start date.')
      setLogs([])
      setAuditSearched(false)
      return
    }

    const requestId = auditRequestIdRef.current + 1
    auditRequestIdRef.current = requestId
    setAuditLoading(true)
    try {
      const params = {
        type: auditMode,
      }
      if (auditMode === 'client' || auditMode === 'agent') {
        params.query = auditQuery.trim()
      }
      if (startIso) params.start = startIso
      if (endIso) params.end = endIso
      const res = await adminApi.get('/admin/audit', { params })
      if (auditRequestIdRef.current === requestId) {
        setLogs(res.data.logs || [])
        setAuditSearched(true)
      }
    } catch (err) {
      if (auditRequestIdRef.current === requestId) {
        setLogs([])
        setAuditError(err.response?.data?.error || 'Failed to load audit logs.')
        setAuditSearched(true)
      }
    } finally {
      if (auditRequestIdRef.current === requestId) {
        setAuditLoading(false)
      }
    }
  }

  const handleOtpLookup = async () => {
    const email = otpEmail.trim().toLowerCase()
    if (!email) {
      toast.error('Enter an agent email to lookup the OTP.')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    setOtpResult(null)
    try {
      const res = await adminApi.get('/admin/email-otp', { params: { email } })
      setOtpResult({ ...res.data, email })
      toast.success('OTP loaded')
    } catch (err) {
      const message = err.response?.data?.error || 'OTP lookup failed'
      setOtpError(message)
      toast.error(message)
    } finally {
      setOtpLoading(false)
    }
  }

  const loadContentEntries = async () => {
    setContentLoading(true)
    try {
      const res = await adminApi.get('/admin/site-content')
      setContentEntries(res.data.content || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load site content')
    } finally {
      setContentLoading(false)
    }
  }

  const updateContentEntry = (slug, patch) => {
    setContentEntries((prev) =>
      prev.map((entry) => (entry.slug === slug ? { ...entry, ...patch } : entry))
    )
  }

  const saveContentEntry = async (slug) => {
    const entry = contentEntries.find((item) => item.slug === slug)
    if (!entry) return
    if (!entry.title?.trim()) {
      toast.error('Title is required')
      return
    }
    setContentSaving(true)
    setContentWarnings([])
    try {
      const res = await adminApi.put(`/admin/site-content/${slug}`, {
        title: entry.title,
        content: entry.content || '',
      })
      const next = res.data?.content
      if (next) {
        updateContentEntry(slug, next)
      }
      setContentWarnings(res.data?.warnings || [])
      toast.success('Content saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save content')
    } finally {
      setContentSaving(false)
    }
  }

  const loadFormSchema = async () => {
    setFormSchemaLoading(true)
    try {
      const res = await adminApi.get('/admin/form-schema/create-profile')
      const nextSchema = res.data?.schema?.schema || null
      const normalizedSchema = filterCreateProfileSchema(nextSchema)
      setFormSchema(normalizedSchema)
      if (normalizedSchema?.sections && !normalizedSchema.sections?.[activeFormSection]) {
        const keys = Object.keys(normalizedSchema.sections)
        setActiveFormSection(keys[0] || 'household')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load form schema')
    } finally {
      setFormSchemaLoading(false)
    }
  }

  const saveFormSchema = async () => {
    if (!formSchema) return
    setFormSchemaSaving(true)
    try {
      await adminApi.put('/admin/form-schema/create-profile', { schema: formSchema })
      toast.success('Form schema saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save form schema')
    } finally {
      setFormSchemaSaving(false)
    }
  }

  const updateSectionLabel = (sectionKey, value) => {
    setFormSchema((prev) => {
      if (!prev?.sections?.[sectionKey]) return prev
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...prev.sections[sectionKey],
            label: value,
          },
        },
      }
    })
  }

  const updateField = (sectionKey, fieldGroupKey, fieldId, patch) => {
    setFormSchema((prev) => {
      if (!prev?.sections?.[sectionKey]) return prev
      const section = prev.sections[sectionKey]
      const fields = Array.isArray(section[fieldGroupKey]) ? section[fieldGroupKey] : []
      const index = fields.findIndex((field) => field.id === fieldId)
      if (index === -1) return prev
      const nextFields = [...fields]
      nextFields[index] = { ...nextFields[index], ...patch }
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            [fieldGroupKey]: nextFields,
          },
        },
      }
    })
  }

  const removeField = (sectionKey, fieldGroupKey, fieldId) => {
    setFormSchema((prev) => {
      if (!prev?.sections?.[sectionKey]) return prev
      const section = prev.sections[sectionKey]
      const fields = Array.isArray(section[fieldGroupKey]) ? section[fieldGroupKey] : []
      const index = fields.findIndex((field) => field.id === fieldId)
      if (index === -1) return prev
      let nextFields = [...fields]
      if (fieldGroupKey === 'customFields') {
        nextFields = nextFields.filter((field) => field.id !== fieldId)
      } else {
        nextFields[index] = {
          ...nextFields[index],
          visible: false,
          removed: true,
        }
      }
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            [fieldGroupKey]: nextFields,
          },
        },
      }
    })
  }

  const addCustomField = (sectionKey) => {
    setFormSchema((prev) => {
      if (!prev?.sections?.[sectionKey]) return prev
      const section = prev.sections[sectionKey]
      const customFields = Array.isArray(section.customFields) ? section.customFields : []
      const id = `custom-${Date.now()}`
      const nextFields = [
        ...customFields,
        { id, label: 'New Field', type: 'text', visible: true },
      ]
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            customFields: nextFields,
          },
        },
      }
    })
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await adminApi.get('/admin/products')
      const items = Array.isArray(res.data?.products) ? res.data.products : []
      setProducts(items)
      if (!activeProductId && items.length) {
        setActiveProductId(String(items[0].id))
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  const addProduct = async () => {
    const name = newProductName.trim()
    if (!name) {
      toast.error('Enter a product name')
      return
    }
    try {
      const res = await adminApi.post('/admin/products', { name })
      const product = res.data?.product
      if (product) {
        setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)))
        setActiveProductId(String(product.id))
      }
      setNewProductName('')
      toast.success('Product added')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add product')
    }
  }

  const loadQuestions = async (productId, sourceFilter = 'all') => {
    setQuestionsLoading(true)
    try {
      const params = {
        ...(productId ? { productId } : {}),
        ...(sourceFilter && sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      }
      const res = await adminApi.get('/admin/questions', { params })
      const items = Array.isArray(res.data?.questions) ? res.data.questions : []
      setQuestions(items)
      setQuestionEdits({})
      const currentProductKey = productId ? String(productId) : ''
      if (currentProductKey !== lastQuestionPrefillProductRef.current) {
        if (currentProductKey && sourceFilter !== 'CUSTOMER') {
          const listText = items
            .filter((question) => question.source === 'SYSTEM')
            .map((question) => question.text)
            .filter(Boolean)
            .join(', ')
          setNewQuestion(listText)
        } else {
          setNewQuestion('')
        }
        lastQuestionPrefillProductRef.current = currentProductKey
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load questions')
    } finally {
      setQuestionsLoading(false)
    }
  }

  const addQuestion = async () => {
    const text = newQuestion.trim()
    if (!text) {
      toast.error('Enter a question')
      return
    }
    try {
      const syncMode = Boolean(activeProductId) && questionSourceFilter !== 'CUSTOMER'
      const payload = { text, ...(syncMode ? { sync: true } : {}) }
      if (activeProductId) payload.productId = Number(activeProductId)
      const res = await adminApi.post('/admin/questions', payload)
      const createdCount = Number(res.data?.created || 0)
      const deletedCount = Number(res.data?.deleted || 0)
      const skippedCount = Number(res.data?.skipped || 0)

      if (syncMode) {
        const updated = Array.isArray(res.data?.questions) ? res.data.questions : []
        if (questionSourceFilter === 'all') {
          await loadQuestions(activeProductId, questionSourceFilter)
        } else {
          setQuestions(updated)
          setQuestionEdits({})
        }
        setNewQuestion(updated.map((question) => question.text).filter(Boolean).join(', '))
        if (createdCount || deletedCount) {
          toast.success(`Saved questions (${createdCount} added, ${deletedCount} removed)`)
        } else {
          toast.success('Saved questions')
        }
        return
      }

      await loadQuestions(activeProductId, questionSourceFilter)
      setNewQuestion('')
      if (createdCount > 1) {
        toast.success(`Added ${createdCount} questions`)
      } else if (createdCount === 1) {
        toast.success('Question added')
      } else if (skippedCount > 0) {
        toast.error('All questions already exist')
      } else {
        toast.error('No questions added')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add question')
    }
  }

  const updateQuestionEdit = (id, value) => {
    setQuestionEdits((prev) => ({ ...prev, [id]: value }))
  }

  const saveQuestionEdit = async (question) => {
    const nextText = (questionEdits[question.id] ?? question.text).trim()
    if (!nextText) {
      toast.error('Question text is required')
      return
    }
    try {
      const res = await adminApi.put(`/admin/questions/${question.id}`, {
        text: nextText,
        source: question.source,
      })
      const updated = res.data?.question
      if (updated) {
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === updated.id && item.source === updated.source ? { ...item, text: updated.text } : item
          )
        )
        setQuestionEdits((prev) => {
          const next = { ...prev }
          delete next[question.id]
          return next
        })
      }
      toast.success('Question updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update question')
    }
  }

  const deleteQuestion = async (question) => {
    try {
      await adminApi.delete(`/admin/questions/${question.id}`, {
        params: question.source ? { source: question.source } : {},
      })
      setQuestions((prev) => prev.filter((item) => item.id !== question.id || item.source !== question.source))
      toast.success('Question removed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove question')
    }
  }

  const renderAgents = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Agents</h2>
        <div className="text-sm text-slate-500">{agents.length} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-[#0b3b8c] hover:underline"
                    onClick={() => openAgentTab(a)}
                  >
                    {a.name || `Agent #${a.id}`}
                  </button>
                </td>
                <td className="px-3 py-2">{a.email || '--'}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-slate-200 px-2 py-1 text-xs capitalize">
                    {a.isSuspended ? 'suspended' : a.status}
                  </span>
                  {a.underReview && <span className="ml-2 text-xs text-amber-600">under review</span>}
                </td>
                <td className="px-3 py-2">{a.availability}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'approve')}>
                    Approve
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'reject')}>
                    Reject
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'review')}>
                    Review
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'suspend')}>
                    Suspend
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'restore')}>
                    Restore
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => doAgentDelete(a.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderClients = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clients</h2>
        <div className="text-sm text-slate-500">{clients.length} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Disabled</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-[#0b3b8c] hover:underline"
                    onClick={() => openClientTab(c)}
                  >
                    {c.name || `Client #${c.id}`}
                  </button>
                </td>
                <td className="px-3 py-2">{c.email || '--'}</td>
                <td className="px-3 py-2">{c.isDisabled ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doClientAction(c.id, 'disable')}>
                    Disable
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doClientAction(c.id, 'enable')}>
                    Enable
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => doClientDelete(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderAudit = () => {
    const modes = [
      { key: 'client', label: 'Client logs' },
      { key: 'agent', label: 'Agent logs' },
      { key: 'admin', label: 'Admin logs' },
    ]
    const modeLabel = auditMode === 'agent' ? 'agent' : 'client'
    const searchLabel = `Search ${modeLabel} logs`
    const searchPlaceholder = 'Name, email, or ID'

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                auditMode === mode.key
                  ? 'border-[#0b3b8c] bg-[#e8f0ff] text-[#0b3b8c]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
              onClick={() => {
                setAuditMode(mode.key)
                setAuditQuery('')
                setAuditError('')
                setAuditSearched(false)
                setLogs([])
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          {auditMode !== 'admin' && (
            <label className="block text-sm">
              {searchLabel}
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={auditQuery}
                onChange={(event) => setAuditQuery(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Start date/time
              <span className="ml-2 text-xs text-slate-400">Optional</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={auditStart}
                onChange={(event) => setAuditStart(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              End date/time
              <span className="ml-2 text-xs text-slate-400">Optional</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={auditEnd}
                onChange={(event) => setAuditEnd(event.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="pill-btn-primary px-4"
              onClick={handleAuditSearch}
              disabled={auditLoading}
            >
              {auditLoading ? 'Searching...' : auditMode === 'admin' ? 'Load logs' : 'Search logs'}
            </button>
            {auditError && <div className="text-sm text-rose-600">{auditError}</div>}
          </div>
        </div>

        {auditSearched && !auditLoading && logs.length === 0 && (
          <div className="text-sm text-slate-500">No logs found.</div>
        )}

        {auditSearched && logs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{l.actorEmail || l.actorId || '--'}</td>
                    <td className="px-3 py-2">
                      {l.targetType} #{l.targetId}
                    </td>
                    <td className="px-3 py-2 capitalize">{l.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderContentManager = () => {
    const contentEntry =
      contentEntries.find((entry) => entry.slug === activeContentSlug) || contentEntries[0] || null
    const contentClasses =
      'space-y-4 text-slate-600 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:leading-relaxed'

    return (
      <div className="space-y-4">
        {contentLoading && <div className="text-slate-500">Loading content...</div>}
        {!contentLoading && !contentEntry && (
          <div className="text-slate-500">No content entries found.</div>
        )}
        {!contentLoading && contentEntry && (
          <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pages</div>
              {contentPages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                    activeContentSlug === page.slug
                      ? 'border-[#0b3b8c] bg-[#e8f0ff] text-[#0b3b8c]'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  onClick={() => {
                    setActiveContentSlug(page.slug)
                    setContentWarnings([])
                  }}
                >
                  {page.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Website Content Manager</div>
                  <div className="text-xs text-slate-500">
                    Last updated:{' '}
                    {contentEntry.lastUpdated ? new Date(contentEntry.lastUpdated).toLocaleString() : 'Not yet saved'} by{' '}
                    {contentEntry.updatedBy || 'system'}
                  </div>
                </div>
                <button
                  type="button"
                  className="pill-btn-primary px-4"
                  onClick={() => saveContentEntry(contentEntry.slug)}
                  disabled={contentSaving}
                >
                  {contentSaving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <label className="block text-sm">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={contentEntry.title || ''}
                  onChange={(e) => updateContentEntry(contentEntry.slug, { title: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Content (HTML or Markdown-style text)
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[220px] font-mono text-xs"
                  value={contentEntry.content || ''}
                  onChange={(e) => updateContentEntry(contentEntry.slug, { content: e.target.value })}
                  spellCheck={false}
                />
              </label>

              {contentWarnings.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <div className="font-semibold">Compliance warnings</div>
                  <ul className="list-disc pl-5">
                    {contentWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Preview</div>
                <div
                  className={contentClasses}
                  dangerouslySetInnerHTML={{ __html: renderSiteContent(contentEntry.content || '') }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderFormsManager = () => {
    const schema = formSchema
      const sections = [
        { key: 'household', label: 'Household', groups: [{ key: 'fields', label: 'Household fields' }] },
        {
          key: 'address',
          label: 'Address',
          groups: [
            { key: 'contactFields', label: 'Contact fields' },
            { key: 'residentialFields', label: 'Residential address fields' },
            { key: 'mailingFields', label: 'Mailing address fields' },
          ],
        },
        { key: 'additional', label: 'Additional', groups: [] },
      ]
      const groupDefaults = {
        household: {
          fields: { label: 'Household fields', visible: true },
        customFields: { label: 'Custom fields', visible: true },
      },
      address: {
        contactFields: { label: 'Contact fields', visible: true },
        residentialFields: { label: 'Residential address fields', visible: true },
          mailingFields: { label: 'Mailing address fields', visible: true },
          customFields: { label: 'Custom fields', visible: true },
        },
        additional: {
          customFields: { label: 'Custom fields', visible: true },
        },
      }
    const activeSection = sections.find((section) => section.key === activeFormSection) || sections[0]
    const sectionData = schema?.sections?.[activeSection.key]
    const fieldTypes = ['text', 'number', 'date', 'email', 'tel']
    const input = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
    const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500'
    const defaultAddressTypes = ['Secondary Home', 'Rental Property']
    const resolvedAddressTypes = Array.isArray(schema?.sections?.address?.addressTypes)
      ? schema.sections.address.addressTypes
      : defaultAddressTypes

    const updateAddressType = (index, value) => {
      setFormSchema((prev) => {
        if (!prev?.sections?.address) return prev
        const current = Array.isArray(prev.sections.address.addressTypes)
          ? [...prev.sections.address.addressTypes]
          : [...defaultAddressTypes]
        current[index] = value
        return {
          ...prev,
          sections: {
            ...prev.sections,
            address: {
              ...prev.sections.address,
              addressTypes: current,
            },
          },
        }
      })
    }

    const addAddressType = () => {
      setFormSchema((prev) => {
        if (!prev?.sections?.address) return prev
        const current = Array.isArray(prev.sections.address.addressTypes)
          ? [...prev.sections.address.addressTypes]
          : [...defaultAddressTypes]
        return {
          ...prev,
          sections: {
            ...prev.sections,
            address: {
              ...prev.sections.address,
              addressTypes: [...current, ''],
            },
          },
        }
      })
    }

    const removeAddressType = (index) => {
      setFormSchema((prev) => {
        if (!prev?.sections?.address) return prev
        const current = Array.isArray(prev.sections.address.addressTypes)
          ? [...prev.sections.address.addressTypes]
          : [...defaultAddressTypes]
        const nextTypes = current.filter((_, itemIndex) => itemIndex !== index)
        return {
          ...prev,
          sections: {
            ...prev.sections,
            address: {
              ...prev.sections.address,
              addressTypes: nextTypes,
            },
          },
        }
      })
    }

    const resolveGroupSettings = (sectionKey, groupKey, fallbackLabel) => {
      const defaults = groupDefaults?.[sectionKey]?.[groupKey] || { label: fallbackLabel, visible: true }
      const stored = sectionData?.groupSettings?.[groupKey] || {}
      const label =
        Object.prototype.hasOwnProperty.call(stored, 'label') ? stored.label : defaults.label || fallbackLabel
      const visible = stored.visible !== false
      return { label, visible }
    }

    const updateGroupSettings = (sectionKey, groupKey, patch) => {
      setFormSchema((prev) => {
        if (!prev?.sections?.[sectionKey]) return prev
        const section = prev.sections[sectionKey]
        const currentGroups = section.groupSettings || {}
        const current = currentGroups[groupKey] || {}
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [sectionKey]: {
              ...section,
              groupSettings: {
                ...currentGroups,
                [groupKey]: {
                  ...current,
                  ...patch,
                },
              },
            },
          },
        }
      })
    }

    const renderFieldGroup = (groupKey, title) => {
      const fields = Array.isArray(sectionData?.[groupKey])
        ? sectionData[groupKey].filter((field) => field.removed !== true)
        : []
      const groupSettings = resolveGroupSettings(activeSection.key, groupKey, title)
      const groupLabel = String(groupSettings.label || '').trim()
      const groupHeading = groupLabel || title
      if (!fields.length) {
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No fields in {title.toLowerCase()}.
          </div>
        )
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{groupHeading}</div>
            {!groupSettings.visible && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                Hidden label
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              Group label
              <input
                className={input}
                value={groupSettings.label ?? ''}
                onChange={(event) =>
                  updateGroupSettings(activeSection.key, groupKey, { label: event.target.value })
                }
                placeholder={title}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={groupSettings.visible !== false}
                onChange={(event) =>
                  updateGroupSettings(activeSection.key, groupKey, { visible: event.target.checked })
                }
              />
              Show label
            </label>
            <button
              type="button"
              className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
              onClick={() => updateGroupSettings(activeSection.key, groupKey, { label: '', visible: false })}
            >
              Remove label
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px] md:items-center">
                  <label className="block text-sm font-semibold text-slate-700">
                    Label
                    <input
                      className={input}
                      value={field.label || ''}
                      onChange={(event) =>
                        updateField(activeSection.key, groupKey, field.id, { label: event.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Type
                    {groupKey === 'customFields' ? (
                      <select
                        className={input}
                        value={field.type || 'text'}
                        onChange={(event) =>
                          updateField(activeSection.key, groupKey, field.id, { type: event.target.value })
                        }
                      >
                        {fieldTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">{field.type || 'text'}</div>
                    )}
                  </label>
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.visible !== false}
                        onChange={(event) =>
                          updateField(activeSection.key, groupKey, field.id, { visible: event.target.checked })
                        }
                      />
                      Visible
                    </label>
                    <button
                      type="button"
                      className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
                      onClick={() => removeField(activeSection.key, groupKey, field.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">Field id: {field.id}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Forms Content Manager</h2>
            <p className="text-sm text-slate-600">Control the Create Profile schema and question bank.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pill-btn-ghost px-4" onClick={loadFormSchema} disabled={formSchemaLoading}>
              {formSchemaLoading ? 'Loading...' : 'Reload schema'}
            </button>
            <button type="button" className="pill-btn-primary px-4" onClick={saveFormSchema} disabled={formSchemaSaving || !schema}>
              {formSchemaSaving ? 'Saving...' : 'Save schema'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'schema', label: 'Schema editor' },
            { id: 'questions', label: 'Question bank' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                formsTab === tab.id ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setFormsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {formsTab === 'schema' && (
          <>
            {formSchemaLoading && <div className="text-slate-500">Loading schema...</div>}
            {!formSchemaLoading && !schema && <div className="text-slate-500">No schema loaded.</div>}
            {!formSchemaLoading && schema && (
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <div className={labelClass}>Sections</div>
                  {sections.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                        activeSection.key === section.key ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                      onClick={() => setActiveFormSection(section.key)}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className={labelClass}>Section label</div>
                    <input
                      className={input}
                      value={sectionData?.label || ''}
                      onChange={(event) => updateSectionLabel(activeSection.key, event.target.value)}
                      placeholder="Section title"
                    />
                  </div>
                  {activeSection.groups.map((group) => renderFieldGroup(group.key, group.label))}
                  {activeSection.key === 'address' && (
                    <div className="space-y-3">
                      <div className={labelClass}>Additional address types</div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</div>
                        <div className="mt-3 space-y-2">
                          {resolvedAddressTypes.map((option, index) => (
                            <div key={`address-type-${index}`} className="flex flex-wrap items-center gap-2">
                              <input
                                className={input}
                                value={option}
                                onChange={(event) => updateAddressType(index, event.target.value)}
                                placeholder="Address type"
                              />
                              <button
                                type="button"
                                className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
                                onClick={() => removeAddressType(index)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="pill-btn-ghost mt-3 px-3 py-1 text-xs"
                          onClick={addAddressType}
                        >
                          Add address type
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {renderFieldGroup('customFields', 'Custom fields')}
                    <button
                      type="button"
                      className="pill-btn-ghost px-3 py-1 text-xs"
                      onClick={() => addCustomField(activeSection.key)}
                    >
                      Add custom field
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {formsTab === 'questions' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Product
                    <select
                      className={input}
                      value={activeProductId}
                      onChange={(event) => setActiveProductId(event.target.value)}
                      disabled={productsLoading}
                    >
                      <option value="">All products</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Source
                    <select
                      className={input}
                      value={questionSourceFilter}
                      onChange={(event) => setQuestionSourceFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="SYSTEM">System</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                  </label>
                  <button type="button" className="pill-btn-ghost px-3 py-1" onClick={loadProducts} disabled={productsLoading}>
                    {productsLoading ? 'Loading...' : 'Refresh products'}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    New product
                    <input
                      className={input}
                      value={newProductName}
                      onChange={(event) => setNewProductName(event.target.value)}
                      placeholder="e.g. Boat Insurance"
                    />
                  </label>
                  <button type="button" className="pill-btn-primary px-4" onClick={addProduct}>
                    Add product
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add question(s)</div>
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[120px]"
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  placeholder="Type questions separated by commas"
                />
                <button type="button" className="pill-btn-primary mt-3 w-full justify-center" onClick={addQuestion}>
                  Add question(s)
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Questions</div>
                <div className="text-xs text-slate-500">{questions.length} total</div>
              </div>
              {questionsLoading && <div className="mt-3 text-slate-500">Loading questions...</div>}
              {!questionsLoading && !questions.length && (
                <div className="mt-3 text-slate-500">No questions for this product yet.</div>
              )}
              {!questionsLoading && questions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {questions.map((question) => (
                    <div
                      key={`${question.source || 'SYSTEM'}-${question.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="flex-1 min-w-[220px]">
                        {question.source === 'CUSTOMER' ? (
                          <>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer question</div>
                            <input
                              className={`${input} mt-1`}
                              value={questionEdits[question.id] ?? question.text}
                              onChange={(event) => updateQuestionEdit(question.id, event.target.value)}
                            />
                            <div className="mt-1 text-xs text-slate-400">
                              Customer: {question.customerName || question.customerEmail || `#${question.customerId || 'unknown'}`}
                            </div>
                            {question.formName ? (
                              <div className="mt-1 text-xs text-slate-400">Form: {question.formName}</div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">System question</div>
                            <div className="text-sm text-slate-700 mt-1">{question.text}</div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {question.source === 'CUSTOMER' && (
                          <button
                            type="button"
                            className="pill-btn-ghost px-2 py-1 text-xs"
                            onClick={() => saveQuestionEdit(question)}
                          >
                            Save
                          </button>
                        )}
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
                          onClick={() => deleteQuestion(question)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDetailContent = (tab) => {
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

  const content = useMemo(() => {
    if (authChecking) {
      return <div className="text-sm text-slate-500">Checking admin session...</div>
    }
    if (!isAuthed) {
      return (
        <form className="max-w-md space-y-4" onSubmit={handleLogin}>
          <div>
            <h1 className="text-2xl font-semibold">Admin login</h1>
            <p className="text-sm text-slate-500">Full control for Connsura admins.</p>
          </div>
          <label className="block text-sm">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              type="email"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              type="password"
            />
          </label>
          <button type="submit" className="pill-btn-primary w-full justify-center">
            Log in
          </button>
        </form>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</div>
            <h1 className="text-2xl font-semibold">Connsura Admin Console</h1>
            <p className="text-sm text-slate-600">Manage agents, clients, and audit logs.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{admin?.email || 'Admin'}</span>
            <button type="button" className="pill-btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'agents', label: 'Agents' },
            { id: 'clients', label: 'Clients' },
            { id: 'audit', label: 'Audit logs' },
            { id: 'content', label: 'Website Content Manager' },
            { id: 'forms', label: 'Forms Content Manager' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === tab.id ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          {detailTabs.length > 0 && <span className="ml-1 text-xs font-semibold uppercase text-slate-400">Open tabs</span>}
          {detailTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                activeDetailTab?.key === tab.key
                  ? 'border-[#0b3b8c] bg-white text-[#0b3b8c]'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setActiveDetailKey(tab.key)}
            >
              <span>{tab.label}</span>
              <span
                role="button"
                className="text-slate-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.key)
                }}
              >
                x
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Email OTP lookup</h2>
              <p className="text-xs text-slate-500">Fetch the latest verification code for an agent.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              Agent email
              <input
                className="mt-1 w-64 rounded-lg border border-slate-200 px-3 py-2"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                placeholder="agent@email.com"
                type="email"
              />
            </label>
            <button
              type="button"
              className="pill-btn-primary px-5"
              onClick={handleOtpLookup}
              disabled={otpLoading}
            >
              {otpLoading ? 'Looking...' : 'Get OTP'}
            </button>
            {otpResult && (
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Code:</span> {otpResult.code}
              </div>
            )}
          </div>
          {otpResult && (
            <div className="mt-2 text-xs text-slate-500">
              Created: {new Date(otpResult.createdAt).toLocaleString()} | Expires:{' '}
              {new Date(otpResult.expiresAt).toLocaleString()} | Attempts: {otpResult.attempts}
            </div>
          )}
          {otpError && <div className="mt-2 text-xs text-red-600">{otpError}</div>}
        </div>
        {activeDetailTab && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm max-w-xl md:max-w-3xl">
            {renderDetailContent(activeDetailTab)}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-h-[300px]">
          {loading && <div className="text-slate-500">Loading...</div>}
          {!loading && view === 'agents' && renderAgents()}
          {!loading && view === 'clients' && renderClients()}
          {!loading && view === 'audit' && renderAudit()}
          {view === 'content' && renderContentManager()}
          {view === 'forms' && renderFormsManager()}
        </div>
      </div>
    )
  }, [
    isAuthed,
    authChecking,
    view,
    loading,
    agents,
    clients,
    logs,
    admin,
    form.email,
    form.password,
    detailTabs,
    activeDetailTab,
    otpEmail,
    otpResult,
    otpLoading,
    otpError,
    contentEntries,
    contentLoading,
    contentSaving,
    activeContentSlug,
    contentWarnings,
    formSchema,
    formSchemaLoading,
    formSchemaSaving,
    activeFormSection,
    formsTab,
    products,
    productsLoading,
    activeProductId,
    questions,
    questionsLoading,
    newQuestion,
    questionSourceFilter,
    questionEdits,
    newProductName,
    auditMode,
    auditQuery,
    auditStart,
    auditEnd,
    auditLoading,
    auditError,
    auditSearched,
  ])

  return <main className="page-shell py-8">{content}</main>
}
