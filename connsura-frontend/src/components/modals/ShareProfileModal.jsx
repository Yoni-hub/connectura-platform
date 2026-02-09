import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useAgents } from '../../context/AgentContext'
import { api } from '../../services/api'
import Modal from '../ui/Modal'
import ShareSummary from '../share/ShareSummary'

const hasText = (value) => typeof value === 'string' && value.trim().length > 0
const hasDetailValue = (value) => {
  if (Array.isArray(value)) return value.some(hasDetailValue)
  if (typeof value === 'string') return hasText(value)
  return value !== null && value !== undefined
}

const getHouseholdHasData = (household) => {
  if (!household) return false
  const primary = household.primary
  const primaryHasData =
    primary &&
    ([primary.fullName, primary.dob, primary.gender].some((value) => hasText(value)) ||
      (Array.isArray(primary.details) && primary.details.some((detail) => hasDetailValue(detail?.value))))
  const additionalHasData = Array.isArray(household.additional)
    ? household.additional.some((person) =>
        [person.fullName, person.dob, person.gender].some((value) => hasText(value)) ||
        (Array.isArray(person.details) && person.details.some((detail) => hasDetailValue(detail?.value)))
      )
    : false
  return primaryHasData || additionalHasData
}

const getAddressHasData = (address) => {
  if (!address) return false
  const primary = address.primary
  const primaryHasData =
    primary &&
    ([primary.phone1, primary.email1, primary.street1].some((value) => hasText(value)) ||
      (Array.isArray(primary.details) && primary.details.some((detail) => hasDetailValue(detail?.value))))
  const additionalHasData = Array.isArray(address.additional)
    ? address.additional.some((entry) =>
        [entry.phone1, entry.email1, entry.street1].some((value) => hasText(value)) ||
          (Array.isArray(entry.details) && entry.details.some((detail) => hasDetailValue(detail?.value)))
      )
    : false
  return primaryHasData || additionalHasData
}

const buildShareUrl = (token) => `${window.location.origin}/share/${token}`

const copyText = async (value, label) => {
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const field = document.createElement('textarea')
      field.value = value
      field.setAttribute('readonly', '')
      field.style.position = 'absolute'
      field.style.left = '-9999px'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      document.body.removeChild(field)
    }
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Unable to copy ${label.toLowerCase()}`)
  }
}

export default function ShareProfileModal({ open, onClose, snapshot, defaultAgentId }) {
  const { user } = useAuth()
  const { agents, loading } = useAgents()
  const [step, setStep] = useState('sections')
  const [activeMethod, setActiveMethod] = useState(null)
  const [accessMode, setAccessMode] = useState('read')
  const pendingActionRef = useRef(null)
  const [showShareConsent, setShowShareConsent] = useState(false)
  const [dataSharingConsented, setDataSharingConsented] = useState(false)
  const [shareConsentChecks, setShareConsentChecks] = useState({
    shareProfile: false,
    exportData: false,
    notResponsible: false,
  })
  const [sections, setSections] = useState({
    household: false,
    address: false,
    additional: false,
    additionalIndexes: [],
  })
  const [shareLoading, setShareLoading] = useState(false)
  const [linkShare, setLinkShare] = useState(null)
  const [agentShare, setAgentShare] = useState(null)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [sendingAgent, setSendingAgent] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const additionalForms = Array.isArray(snapshot?.additionalForms) ? snapshot.additionalForms : []
  const householdAvailable = useMemo(() => getHouseholdHasData(snapshot?.household), [snapshot])
  const addressAvailable = useMemo(() => getAddressHasData(snapshot?.address), [snapshot])
  const additionalAvailable = accessMode === 'edit' ? true : additionalForms.length > 0
  const availableAdditionalIndexes = useMemo(
    () => additionalForms.map((_, index) => index),
    [additionalForms]
  )

  const sectionsPayload = useMemo(
    () => ({
      household: sections.household,
      address: sections.address,
      additional: sections.additional,
      additionalIndexes: sections.additionalIndexes,
    }),
    [sections]
  )

  const selectedSectionLabels = useMemo(() => {
    const labels = []
    if (sections.household) labels.push('Household')
    if (sections.address) labels.push('Address')
    if (sections.additional) {
      labels.push('Additional information')
    } else {
      sections.additionalIndexes.forEach((index) => {
        const form = additionalForms[index]
        labels.push(form?.name || `Additional Form ${index + 1}`)
      })
    }
    return labels
  }, [sections, additionalForms])

  const allSelected = useMemo(() => {
    const additionalSelected =
      !additionalAvailable ||
      (accessMode === 'edit'
        ? sections.additional
        : sections.additional || availableAdditionalIndexes.every((index) => sections.additionalIndexes.includes(index)))
    const householdSelected = !householdAvailable || sections.household
    const addressSelected = !addressAvailable || sections.address
    return householdSelected && addressSelected && additionalSelected
  }, [
    sections,
    householdAvailable,
    addressAvailable,
    additionalAvailable,
    availableAdditionalIndexes,
    accessMode,
  ])

  const hasSelection =
    sections.household ||
    sections.address ||
    sections.additional ||
    (sections.additionalIndexes && sections.additionalIndexes.length > 0)

  const hasAvailableSections = householdAvailable || addressAvailable || additionalAvailable

  useEffect(() => {
    if (open) setAccessMode('read')
  }, [open])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const shouldEnablePrint = open && activeMethod === 'pdf' && accessMode !== 'edit'
    document.body.classList.toggle('print-share-open', shouldEnablePrint)
    return () => document.body.classList.remove('print-share-open')
  }, [open, activeMethod, accessMode])

  useEffect(() => {
    if (!open) {
      setShowShareConsent(false)
      pendingActionRef.current = null
      return
    }
    const nextSections = {
      household: householdAvailable,
      address: addressAvailable,
      additional: accessMode === 'edit' ? additionalAvailable : false,
      additionalIndexes: additionalAvailable && accessMode !== 'edit' ? [...availableAdditionalIndexes] : [],
    }
    setSections(nextSections)
    setStep('sections')
    setActiveMethod(null)
    setShareLoading(false)
    setLinkShare(null)
    setAgentShare(null)
    setSelectedAgentId(defaultAgentId ? String(defaultAgentId) : '')
    setRecipientName('')
  }, [
    open,
    accessMode,
    householdAvailable,
    addressAvailable,
    additionalAvailable,
    availableAdditionalIndexes,
    defaultAgentId,
  ])

  const startShareAction = (action) => {
    if (dataSharingConsented) {
      void action()
      return
    }
    pendingActionRef.current = action
    setShowShareConsent(true)
  }

  useEffect(() => {
    if (accessMode === 'edit' && activeMethod === 'pdf') {
      setActiveMethod('link')
    }
  }, [accessMode, activeMethod])

  useEffect(() => {
    if (!showShareConsent) return
    setShareConsentChecks({ shareProfile: false, exportData: false, notResponsible: false })
  }, [showShareConsent])

  const toggleShareAll = () => {
    if (allSelected) {
      setSections({ household: false, address: false, additional: false, additionalIndexes: [] })
      return
    }
    setSections({
      household: householdAvailable,
      address: addressAvailable,
      additional: additionalAvailable,
      additionalIndexes: additionalAvailable && accessMode !== 'edit' ? [...availableAdditionalIndexes] : [],
    })
  }

  const toggleAdditionalForm = (index) => {
    if (accessMode === 'edit') return
    setSections((prev) => {
      const next = new Set(prev.additionalIndexes)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return { ...prev, additional: false, additionalIndexes: Array.from(next).sort((a, b) => a - b) }
    })
  }

  const createShare = async (agentId) => {
    if (!snapshot) {
      toast.error('Profile snapshot not ready')
      return null
    }
    if (!user) {
      toast.error('Login required to share')
      return null
    }
    setShareLoading(true)
    try {
      const payload = { sections: sectionsPayload, snapshot, editable: accessMode === 'edit' }
      const trimmedRecipientName = recipientName.replace(/\s+/g, ' ').trim()
      if (agentId) payload.agentId = agentId
      if (!agentId && trimmedRecipientName) payload.recipientName = trimmedRecipientName
      const res = await api.post('/shares', payload)
      return res.data
    } catch (err) {
      if (err.response?.data?.code === 'CONSENT_REQUIRED') {
        setDataSharingConsented(false)
        setShowShareConsent(true)
        return null
      }
      toast.error(err.response?.data?.error || 'Unable to create share link')
      return null
    } finally {
      setShareLoading(false)
    }
  }

  const allShareConsentsChecked =
    shareConsentChecks.shareProfile && shareConsentChecks.exportData && shareConsentChecks.notResponsible

  const handleShareConsentConfirm = async () => {
    if (!allShareConsentsChecked) {
      toast.error('Please accept all required sharing consents.')
      return
    }
    try {
      await api.post('/legal/consent', {
        documentType: 'data-sharing',
        consentItems: {
          shareProfile: true,
          exportData: true,
          notResponsible: true,
        },
      })
      setDataSharingConsented(true)
      setShowShareConsent(false)
      const action = pendingActionRef.current
      pendingActionRef.current = null
      if (action) {
        void action()
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save consent')
    }
  }

  const handleContinue = () => {
    if (!hasSelection) {
      toast.error('Select at least one section to share')
      return
    }
    setStep('method')
  }

  const handleMethodChange = (method) => {
    setActiveMethod(method)
  }

  const handleCreateLink = async () => {
    handleMethodChange('link')
  }

  const handleGenerateLink = async () => {
    const trimmedRecipientName = recipientName.replace(/\s+/g, ' ').trim()
    if (!trimmedRecipientName) {
      toast.error('Enter the recipient name')
      return
    }
    startShareAction(async () => {
      if (linkShare || shareLoading) return
      const share = await createShare()
      if (share) setLinkShare(share)
    })
  }

  const handleSendToAgent = async () => {
    const agentId = Number(selectedAgentId)
    if (!agentId) {
      toast.error('Select an agent first')
      return
    }
    startShareAction(async () => {
      setSendingAgent(true)
      const share = await createShare(agentId)
      if (!share) {
        setSendingAgent(false)
        return
      }
      setAgentShare(share)
      const shareUrl = buildShareUrl(share.share.token)
      const messageLines = [
        `Shared profile sections: ${selectedSectionLabels.join(', ') || 'None'}.`,
        accessMode === 'edit' ? 'Editing is enabled for this share.' : null,
        `Link: ${shareUrl}`,
        `Access code: ${share.code}`,
        'The link requires the 4-digit code from the customer.',
      ].filter(Boolean)
      try {
        const convoRes = await api.post('/api/messages/conversations', { agentId })
        const conversationId = convoRes.data?.conversationId
        if (!conversationId) {
          throw new Error('No conversation id')
        }
        await api.post(`/api/messages/conversations/${conversationId}/messages`, {
          body: messageLines.join('\n'),
        })
        toast.success('Share sent to agent')
      } catch (err) {
        toast.error(err.response?.data?.error || 'Unable to send to agent')
      } finally {
        setSendingAgent(false)
      }
    })
  }

  const renderShareDetails = (share) => {
    if (!share?.share?.token) return null
    const shareUrl = buildShareUrl(share.share.token)
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Share link</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {shareUrl}
            </div>
            <button
              type="button"
              className="pill-btn-ghost px-3"
              onClick={() => copyText(shareUrl, 'Link')}
            >
              Copy link
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Access code</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-lg font-semibold tracking-[0.3em] text-slate-700">
              {share.code}
            </div>
            <button
              type="button"
              className="pill-btn-ghost px-3"
              onClick={() => copyText(share.code, 'Code')}
            >
              Copy code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Modal
        title="Share your profile"
        open={open}
        onClose={() => {
          if (!shareLoading && !sendingAgent) onClose?.()
        }}
        panelClassName="max-w-4xl"
      >
        {step === 'sections' ? (
          <div className="print-hidden space-y-4">
            <div className="text-sm text-slate-600">
              Choose which sections you want to share. You can share all sections or pick specific ones.
            </div>
            {!hasAvailableSections ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No profile data available to share yet. Fill out your profile first.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allSelected}
                      onChange={toggleShareAll}
                    />
                    Share all sections
                  </label>
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="share-access"
                        className="h-4 w-4"
                        checked={accessMode === 'read'}
                        onChange={() => setAccessMode('read')}
                      />
                      Read only
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="share-access"
                        className="h-4 w-4"
                        checked={accessMode === 'edit'}
                        onChange={() => setAccessMode('edit')}
                      />
                      Allow edits
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sections.household}
                      onChange={() => setSections((prev) => ({ ...prev, household: !prev.household }))}
                      disabled={!householdAvailable}
                    />
                    Household information
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sections.address}
                      onChange={() => setSections((prev) => ({ ...prev, address: !prev.address }))}
                      disabled={!addressAvailable}
                    />
                    Address information
                  </label>
                </div>

                {additionalForms.length > 0 && accessMode !== 'edit' && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Additional forms
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {additionalForms.map((form, index) => (
                        <label key={`share-form-${index}`} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={sections.additionalIndexes.includes(index)}
                            onChange={() => toggleAdditionalForm(index)}
                          />
                          {form?.name || `Additional Form ${index + 1}`}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {additionalAvailable && accessMode === 'edit' && (
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sections.additional}
                      onChange={() => setSections((prev) => ({ ...prev, additional: !prev.additional }))}
                    />
                    Additional information
                  </label>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="pill-btn-ghost px-4" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={handleContinue}
                disabled={!hasAvailableSections}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="print-hidden flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <div>Choose how you want to share your profile.</div>
              <button
                type="button"
                className="text-sm font-semibold text-[#006aff] hover:underline"
                onClick={() => {
                  setStep('sections')
                  setActiveMethod(null)
                  setLinkShare(null)
                  setAgentShare(null)
                }}
              >
                Change sections
              </button>
            </div>

            <div
              className={`print-hidden grid gap-3 ${accessMode === 'edit' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
            >
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  activeMethod === 'link'
                    ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={handleCreateLink}
              >
                Share with link
              </button>
              {accessMode !== 'edit' && (
                <button
                  type="button"
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    activeMethod === 'pdf'
                      ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => handleMethodChange('pdf')}
                >
                  Share as PDF
                </button>
              )}
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  activeMethod === 'agent'
                    ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => handleMethodChange('agent')}
              >
                Share with agent
              </button>
            </div>

            {activeMethod === 'link' && (
              <div className="print-hidden space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  Create a public link with a 4-digit access code.
                </div>
                <label className="block text-sm">
                  Recipient name
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={recipientName}
                    onChange={(event) => {
                      setRecipientName(event.target.value)
                      if (linkShare) setLinkShare(null)
                    }}
                    placeholder="e.g., John Doe"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="pill-btn-primary px-5"
                    onClick={handleGenerateLink}
                    disabled={shareLoading}
                  >
                    {shareLoading ? 'Creating...' : 'Create link'}
                  </button>
                </div>
                {linkShare && renderShareDetails(linkShare)}
              </div>
            )}

            {activeMethod === 'agent' && (
              <div className="print-hidden space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  Send a secure link and code to an agent. They will only see the sections you selected.
                </div>
                <label className="block text-sm">
                  Agent
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={selectedAgentId}
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select an agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="pill-btn-primary px-5"
                    onClick={handleSendToAgent}
                    disabled={sendingAgent || shareLoading}
                  >
                    {sendingAgent ? 'Sending...' : 'Send to agent'}
                  </button>
                </div>
                {agentShare && renderShareDetails(agentShare)}
              </div>
            )}

            {activeMethod === 'pdf' && accessMode !== 'edit' && (
              <div className="print-share-shell space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="print-hidden text-sm text-slate-600">Preview your PDF before printing.</div>
                <div className="print-share-area rounded-2xl border border-slate-200 bg-white p-4">
                  <ShareSummary snapshot={snapshot} sections={sectionsPayload} />
                </div>
                <div className="print-hidden flex justify-end">
                  <button type="button" className="pill-btn-primary px-5" onClick={() => window.print()}>
                    Print to PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {showShareConsent && (
        <Modal title="Share consent" open={showShareConsent} showClose={false} panelClassName="max-w-lg">
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              Before sharing your profile, please confirm the following:
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={shareConsentChecks.shareProfile}
                onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, shareProfile: e.target.checked }))}
              />
              I consent to sharing my insurance profile with this agent
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={shareConsentChecks.exportData}
                onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, exportData: e.target.checked }))}
              />
              I understand the agent may export and store my data
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={shareConsentChecks.notResponsible}
                onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, notResponsible: e.target.checked }))}
              />
              I understand Connsura is not responsible after export
            </label>
            <div className="text-xs text-slate-500">
              Review the full{' '}
              <a className="underline" href="/data-sharing" target="_blank" rel="noreferrer">
                Data Sharing policy
              </a>
              .
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={handleShareConsentConfirm}
                disabled={!allShareConsentsChecked}
              >
                Continue
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
