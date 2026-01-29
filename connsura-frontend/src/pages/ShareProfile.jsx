import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ShareSummary from '../components/share/ShareSummary'
import ShareEditsStatusModal from '../components/modals/ShareEditsStatusModal'
import Modal from '../components/ui/Modal'
import CreateProfile from './CreateProfile'

export default function ShareProfile() {
  const { token } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editData, setEditData] = useState(null)
  const [savingEdits, setSavingEdits] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [viewerName, setViewerName] = useState('')
  const [endingSession, setEndingSession] = useState(false)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState('')
  const [showAgentConsent, setShowAgentConsent] = useState(false)
  const [agentAccessConsented, setAgentAccessConsented] = useState(false)
  const [agentConsentChecks, setAgentConsentChecks] = useState({
    legitimateUse: false,
    noResell: false,
    protectData: false,
  })
  const pendingStatusRef = useRef('')
  const pendingVerifyRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const isAwaitingApproval = approvalModalOpen && approvalStatus === 'pending'

  const accessCode = code.trim()
  const recipientName = viewerName.replace(/\s+/g, ' ').trim()
  const isEditable = Boolean(share?.editable)
  const additionalAllowed = Boolean(share?.sections?.additional) ||
    (share?.sections?.additionalIndexes && share.sections.additionalIndexes.length > 0)
  const allowedSections = useMemo(() => {
    if (!isEditable || !share?.sections) return null
    return {
      household: Boolean(share.sections.household),
      address: Boolean(share.sections.address),
      additional: additionalAllowed,
      summary: true,
    }
  }, [isEditable, share?.sections, additionalAllowed])

  const syncPendingStatus = (nextShare) => {
    if (!nextShare?.editable) return
    if (!approvalModalOpen) return
    const nextStatus = nextShare?.pendingStatus || ''
    if (!nextStatus) return
    if (pendingStatusRef.current !== nextStatus) {
      pendingStatusRef.current = nextStatus
      setApprovalStatus(nextStatus)
      return
    }
    setApprovalStatus(nextStatus)
  }

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const handleVerify = async () => {
    pendingVerifyRef.current = false
    if (!accessCode) {
      toast.error('Enter the 4-digit code')
      return
    }
    if (!token) {
      toast.error('Invalid share link')
      return
    }
    setLoading(true)
    setError('')
    setSessionExpired(false)
    try {
      const res = await api.post(`/shares/${token}/verify`, {
        code: accessCode,
        name: recipientName,
        touch: true,
      })
      const nextShare = res.data?.share || null
      setShare(nextShare)
      markActivity()
      if (user?.role === 'AGENT') {
        setAgentAccessConsented(true)
      }
      setSessionExpired(false)
      if (nextShare?.status === 'revoked' || nextShare?.status === 'expired') {
        setSessionExpired(true)
      }
    } catch (err) {
      if (err.response?.data?.code === 'CONSENT_REQUIRED') {
        setAgentAccessConsented(false)
        pendingVerifyRef.current = true
        setShowAgentConsent(true)
        return
      }
      if (err.response?.status === 410) {
        setSessionExpired(true)
        setError('Your session has expired.')
      } else {
        const message = err.response?.data?.error || 'Unable to verify code'
        setError(message)
      }
      pendingStatusRef.current = ''
      setApprovalStatus('')
      setApprovalModalOpen(false)
      setShare(null)
    } finally {
      setLoading(false)
    }
  }

  const allAgentConsentsChecked =
    agentConsentChecks.legitimateUse && agentConsentChecks.noResell && agentConsentChecks.protectData

  const handleAgentConsentConfirm = async () => {
    if (!allAgentConsentsChecked) {
      toast.error('Please accept all required consents.')
      return
    }
    try {
      await api.post('/legal/consent', {
        documentType: 'data-sharing',
        consentItems: {
          legitimateUse: true,
          noResell: true,
          protectData: true,
        },
      })
      setAgentAccessConsented(true)
      setShowAgentConsent(false)
      if (pendingVerifyRef.current) {
        pendingVerifyRef.current = false
        void handleVerify()
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save consent')
    }
  }

  const handleSubmitEdits = async () => {
    if (!token) return
    if (!accessCode) {
      toast.error('Enter the 4-digit code')
      return
    }
    if (!editData) {
      toast.error('Profile form not ready')
      return
    }
    setSavingEdits(true)
    try {
      const res = await api.post(`/shares/${token}/edits`, {
        code: accessCode,
        name: recipientName,
        edits: { forms: editData },
      })
      const nextShare = res.data?.share || null
      pendingStatusRef.current = 'pending'
      setApprovalStatus('pending')
      setApprovalModalOpen(true)
      if (nextShare) {
        setShare(nextShare)
        syncPendingStatus(nextShare)
      }
    } catch (err) {
      if (err.response?.status === 410) {
        setSessionExpired(true)
      } else {
        toast.error(err.response?.data?.error || 'Unable to submit edits')
      }
    } finally {
      setSavingEdits(false)
    }
  }

  useEffect(() => {
    if (!showAgentConsent) return
    setAgentConsentChecks({ legitimateUse: false, noResell: false, protectData: false })
  }, [showAgentConsent])

  useEffect(() => {
    if (!token || !accessCode || !share || sessionExpired) return
    const intervalMs = 5000
    const interval = setInterval(async () => {
      try {
        const recentlyActive = Date.now() - lastActivityRef.current < 60000
        const res = await api.post(`/shares/${token}/verify`, {
          code: accessCode,
          name: recipientName,
          touch: recentlyActive,
        })
        const nextShare = res.data?.share || null
        if (nextShare) {
          setShare(nextShare)
          syncPendingStatus(nextShare)
        }
        if (nextShare?.status === 'revoked' || nextShare?.status === 'expired') {
          setSessionExpired(true)
        }
      } catch (err) {
        if (err.response?.status === 410) {
          setSessionExpired(true)
        }
      }
    }, intervalMs)
    return () => clearInterval(interval)
  }, [isEditable, token, accessCode, share, recipientName, sessionExpired])

  useEffect(() => {
    if (!share || sessionExpired) return
    const handleActivity = () => markActivity()
    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('click', handleActivity, { passive: true })
    window.addEventListener('scroll', handleActivity, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [share, sessionExpired, markActivity])

  useEffect(() => {
    if (!share || sessionExpired || !token || !accessCode) return
    const interval = setInterval(async () => {
      const inactiveMs = Date.now() - lastActivityRef.current
      if (inactiveMs < 10 * 60 * 1000) return
      try {
        await api.post(`/shares/${token}/close`, { code: accessCode, name: recipientName })
      } catch {
        // Ignore close errors; session will be marked expired locally.
      } finally {
        setSessionExpired(true)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [share, sessionExpired, token, accessCode, recipientName])

  useEffect(() => {
    if (!sessionExpired) return
    pendingStatusRef.current = ''
    setApprovalStatus('')
    setApprovalModalOpen(false)
  }, [sessionExpired])

  useEffect(() => {
    if (!isAwaitingApproval || typeof document === 'undefined') return
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
  }, [isAwaitingApproval])

  const handleEndSession = async () => {
    if (!token || !accessCode) {
      toast.error('Enter the access code first')
      return
    }
    setEndingSession(true)
    try {
      await api.post(`/shares/${token}/close`, { code: accessCode, name: recipientName })
      setSessionExpired(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to close the session')
    } finally {
      setEndingSession(false)
    }
  }

  return (
    <main className="page-shell py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Shared insurance profile</h1>
          <p className="text-slate-500">Enter the 4-digit code from the customer to unlock their profile.</p>
        </div>

        <div className="surface p-5 max-w-xl space-y-3">
          <label className="block text-sm">
            Access code
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="1234"
            />
          </label>
          <label className="block text-sm">
            Recipient name (for public links)
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={viewerName}
              onChange={(event) => setViewerName(event.target.value)}
              placeholder="Enter the name shared by the customer"
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="pill-btn-primary px-5" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock profile'}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {sessionExpired && (
          <div className="surface p-5 max-w-xl space-y-3">
            <div className="text-lg font-semibold text-slate-900">Your session has expired</div>
            <div className="text-sm text-slate-600">
              This share is no longer active.
            </div>
            <button type="button" className="pill-btn-primary px-5" onClick={() => nav('/')}>
              Close
            </button>
          </div>
        )}

        {share && !sessionExpired && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">
              Shared by {share.customer?.name || 'a customer'}.
            </div>
            {isEditable ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  You can edit the shared sections. Changes will be sent to the client for approval.
                </div>
                <div
                  className={isAwaitingApproval ? 'pointer-events-none select-none opacity-60' : ''}
                  aria-disabled={isAwaitingApproval}
                >
                  <CreateProfile
                    initialData={share.snapshot?.forms || {}}
                    onFormDataChange={(data) => {
                      setEditData(data)
                      markActivity()
                    }}
                    allowedSections={allowedSections}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">Submit changes when you are done editing.</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="pill-btn-ghost px-5"
                      onClick={handleEndSession}
                      disabled={endingSession || isAwaitingApproval}
                    >
                      {endingSession ? 'Ending...' : 'End session'}
                    </button>
                    <button
                      type="button"
                      className="pill-btn-primary px-6"
                      onClick={handleSubmitEdits}
                      disabled={savingEdits || isAwaitingApproval}
                    >
                      {savingEdits ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ShareSummary snapshot={share.snapshot} sections={share.sections} />
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="pill-btn-ghost px-5"
                    onClick={handleEndSession}
                    disabled={endingSession}
                  >
                    {endingSession ? 'Ending...' : 'End session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ShareEditsStatusModal
        open={approvalModalOpen}
        status={approvalStatus}
        onClose={() => setApprovalModalOpen(false)}
      />
      {showAgentConsent && (
        <Modal title="Data access consent" open={showAgentConsent} showClose={false} panelClassName="max-w-lg">
          <div className="space-y-4 text-sm text-slate-700">
            <p>Before viewing this shared profile, please confirm the following:</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={agentConsentChecks.legitimateUse}
                onChange={(e) => setAgentConsentChecks((prev) => ({ ...prev, legitimateUse: e.target.checked }))}
              />
              I will use this data only for legitimate insurance purposes
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={agentConsentChecks.noResell}
                onChange={(e) => setAgentConsentChecks((prev) => ({ ...prev, noResell: e.target.checked }))}
              />
              I will not resell or misuse this data
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={agentConsentChecks.protectData}
                onChange={(e) => setAgentConsentChecks((prev) => ({ ...prev, protectData: e.target.checked }))}
              />
              I will protect this data under applicable law
            </label>
            <div className="text-xs text-slate-500">
              Review the full{' '}
              <a className="underline" href="/data-sharing" target="_blank" rel="noreferrer">
                Data Sharing policy
              </a>
              .
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={handleAgentConsentConfirm}
                disabled={!allAgentConsentsChecked}
              >
                Continue
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
