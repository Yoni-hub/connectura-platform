import { useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'

export default function AuthenticatorPanel() {
  const { user, setUser } = useAuth()
  const [setupData, setSetupData] = useState(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableBackupCode, setDisableBackupCode] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  const enabled = Boolean(user?.totpEnabled)
  const startSetup = async () => {
    setSetupLoading(true)
    try {
      const res = await api.post('/auth/totp/setup')
      setSetupData(res.data)
      if (res.data?.user) setUser(res.data.user)
      toast.success('Authenticator setup started')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start setup')
    } finally {
      setSetupLoading(false)
    }
  }

  const confirmSetup = async () => {
    const code = confirmCode.trim()
    if (!code) {
      toast.error('Enter the authenticator code')
      return
    }
    setConfirming(true)
    try {
      const res = await api.post('/auth/totp/confirm', { code })
      if (res.data?.user) setUser(res.data.user)
      setSetupData(null)
      setConfirmCode('')
      toast.success('Authenticator enabled')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to enable authenticator')
    } finally {
      setConfirming(false)
    }
  }

  const disableAuthenticator = async () => {
    const password = disablePassword
    const code = disableCode.trim()
    const backupCode = disableBackupCode.trim()
    if (!password) {
      toast.error('Enter your password')
      return
    }
    if (!code && !backupCode) {
      toast.error('Enter an authenticator or backup code')
      return
    }
    setDisableLoading(true)
    try {
      const res = await api.post('/auth/totp/disable', { password, code, backupCode })
      if (res.data?.user) setUser(res.data.user)
      setSetupData(null)
      setConfirmCode('')
      setDisablePassword('')
      setDisableCode('')
      setDisableBackupCode('')
      setDisableOpen(false)
      toast.success('Authenticator disabled')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disable authenticator')
    } finally {
      setDisableLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-slate-500">Authenticator app</div>
          <div className="font-semibold text-slate-900">Google Authenticator recovery</div>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? 'Enabled' : 'Optional'}
        </div>
      </div>

      <p className="text-sm text-slate-600">
        Add Google Authenticator to recover your account even if you lose access to email.
      </p>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
        <div className="font-semibold text-slate-700">Setup guide</div>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>WHEN: set this up right after your first login.</li>
          <li>
            How: click "Set up authenticator" below.
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>You will get a QR code, manual setup key, a recovery ID, and backup codes.</li>
              <li>Save your recovery ID and backup codes for future use.</li>
              <li>Scan the QR or enter the manual setup key in Google Authenticator, then enter the 6-digit code to confirm.</li>
            </ul>
          </li>
          <li>
            USE IT: click "Forgot password" on the sign-in screen.
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>On the recovery page, enter your email or recovery ID.</li>
              <li>Enter either the authenticator code or a backup code, plus your new password.</li>
            </ul>
          </li>
        </ul>
      </div>

      {!enabled && !setupData && (
        <button type="button" className="pill-btn-primary px-5" onClick={startSetup} disabled={setupLoading}>
          {setupLoading ? 'Starting...' : 'Set up authenticator'}
        </button>
      )}

      {setupData && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <div className="grid gap-4 sm:grid-cols-[160px,1fr] items-start">
            <div className="rounded-lg bg-white p-2 border border-slate-200 w-full">
              {setupData.qrDataUrl ? (
                <img src={setupData.qrDataUrl} alt="Authenticator QR" className="w-full" />
              ) : (
                <div className="text-xs text-slate-500">QR code unavailable</div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-slate-500">Manual setup key</div>
                <div className="font-mono text-slate-900 break-all">{setupData.secret}</div>
              </div>
              <div>
                <div className="text-slate-500">Recovery ID</div>
                <div className="font-mono text-slate-900">{setupData.recoveryId}</div>
              </div>
            </div>
          </div>

          {Array.isArray(setupData.backupCodes) && setupData.backupCodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">Backup codes (save these now)</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {setupData.backupCodes.map((code) => (
                  <div key={code} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-700">
                    {code}
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Backup codes are shown only once. Store them in a safe place.
              </div>
            </div>
          )}

          {!enabled && (
            <div className="space-y-2">
              <label className="block text-sm">
                Enter the 6-digit code from your app to confirm
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={confirmSetup}
                disabled={confirming}
              >
                {confirming ? 'Verifying...' : 'Enable authenticator'}
              </button>
            </div>
          )}
        </div>
      )}

      {enabled && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="font-semibold">Authenticator is set up</div>
            <div className="text-emerald-800">You can use your recovery ID and codes if you forget your password.</div>
          </div>
          <button
            type="button"
            className="pill-btn-primary px-4"
            onClick={() => setDisableOpen(true)}
          >
            Disable authenticator
          </button>
          <Modal title="Disable authenticator" open={disableOpen} onClose={() => setDisableOpen(false)}>
            <div className="space-y-3 text-sm text-slate-600">
              <p>Confirm your password, then enter either an authenticator code or a backup code.</p>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Authenticator code
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Backup code
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={disableBackupCode}
                  onChange={(e) => setDisableBackupCode(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="pill-btn-ghost"
                  onClick={() => setDisableOpen(false)}
                  disabled={disableLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pill-btn-primary px-4"
                  onClick={disableAuthenticator}
                  disabled={disableLoading}
                >
                  {disableLoading ? 'Disabling...' : 'Disable authenticator'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}
