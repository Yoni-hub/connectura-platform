import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext'
import { useAgents } from '../context/AgentContext'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import { API_URL } from '../services/api'

export default function Dashboard() {
  const { profile, loading, loadProfile } = useProfile()
  const { agents } = useAgents()
  const nav = useNavigate()

  useEffect(() => {
    loadProfile()
  }, [])

  const preferredAgent = useMemo(
    () => agents.find((a) => a.id === profile?.preferredAgentId),
    [agents, profile?.preferredAgentId]
  )

  return (
    <main className="page-shell py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customer dashboard</h1>
          <p className="text-slate-500">Profile, saved agent, call actions, and post-sale summary</p>
        </div>
        <button
          onClick={() => window.open(`${API_URL}/forms/customer-information.html`, '_blank')}
          className="pill-btn-primary"
        >
          Create your insurance profile now
        </button>
      </div>

      {loading && <Skeleton className="h-24" />}

      {profile && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface p-5 lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Profile</h2>
              {profile.sharedWithAgent ? <Badge label="Shared" tone="green" /> : <Badge label="Not shared" tone="gray" />}
            </div>
            <div className="text-sm text-slate-600">Preferred languages: {profile.preferredLangs.join(', ') || '—'}</div>
            <div className="text-sm text-slate-600">Coverages: {profile.coverages.join(', ') || '—'}</div>
            <div className="text-sm text-slate-600">
              Prior insurance: {profile.priorInsurance.map((p) => p.carrier).join(', ') || '—'}
            </div>

            {profile.profileData && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="font-semibold mb-1">Contact</div>
                  <div className="text-sm text-slate-600">Phone: {profile.profileData.contact?.phone || '—'}</div>
                  <div className="text-sm text-slate-600">Best time: {profile.profileData.contact?.bestTime || '—'}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="font-semibold mb-1">Address</div>
                  <div className="text-sm text-slate-600">
                    {profile.profileData.address?.street || '—'}
                    {profile.profileData.address?.city ? `, ${profile.profileData.address.city}` : ''}
                  </div>
                  <div className="text-sm text-slate-600">
                    {profile.profileData.address?.state || ''} {profile.profileData.address?.zip || ''}
                  </div>
                </div>
              </div>
            )}

            {profile.profileData?.interests?.length ? (
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="font-semibold mb-1">Insurance products</div>
                <div className="text-sm text-slate-600">{profile.profileData.interests.join(', ')}</div>
              </div>
            ) : null}

            {profile.profileData?.property && (
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-1">
                <div className="font-semibold mb-1">Property</div>
                <div className="text-sm text-slate-600">Type: {profile.profileData.property.type || '—'}</div>
                <div className="text-sm text-slate-600">Year built: {profile.profileData.property.yearBuilt || '—'}</div>
                <div className="text-sm text-slate-600">
                  Square feet: {profile.profileData.property.squareFeet || '—'}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="font-semibold mb-2">Drivers</div>
                {profile.drivers.map((d, idx) => (
                  <div key={idx} className="text-sm text-slate-600">
                    {d.name} — {d.relationship}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="font-semibold mb-2">Vehicles</div>
                {profile.vehicles.map((v, idx) => (
                  <div key={idx} className="text-sm text-slate-600">
                    {v.year} {v.make} {v.model}
                  </div>
                ))}
              </div>
            </div>

            {profile.profileData?.claimsHistory && (
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="font-semibold mb-1">Claims history</div>
                <div className="text-sm text-slate-600">{profile.profileData.claimsHistory}</div>
              </div>
            )}
            {profile.profileData?.notes && (
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="font-semibold mb-1">Notes</div>
                <div className="text-sm text-slate-600">{profile.profileData.notes}</div>
              </div>
            )}
          </div>

          <div className="surface p-5 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Preferred agent</h2>
              <Badge label={preferredAgent ? 'Saved' : 'None'} tone={preferredAgent ? 'green' : 'gray'} />
            </div>
            {preferredAgent ? (
              <>
                <div className="font-semibold">{preferredAgent.name}</div>
                <div className="text-sm text-slate-500">{preferredAgent.languages.join(', ')}</div>
                <div className="flex gap-2">
                  <button onClick={() => nav(`/call/voice/${preferredAgent.id}`)} className="pill-btn-primary text-sm">
                    Voice call
                  </button>
                  <button
                    onClick={() => nav(`/call/video/${preferredAgent.id}`)}
                    className="pill-btn bg-slate-900 text-white text-sm hover:bg-slate-800"
                  >
                    Video call
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Share your profile with an agent to save them here.</div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface p-5 space-y-2">
          <h3 className="font-semibold">Quote placeholder</h3>
          <div className="text-sm text-slate-600">Price: $132/month</div>
          <div className="text-sm text-slate-600">Coverages: Liability 100/300, Comp/Coll 500/500</div>
          <div className="flex gap-2">
            <button className="pill-btn-primary text-sm">Proceed</button>
            <button className="pill-btn-ghost text-sm">Decline</button>
          </div>
        </div>
        <div className="surface p-5 space-y-2">
          <h3 className="font-semibold">Post-sale summary</h3>
          <div className="text-sm text-slate-600">Carrier: Progressive</div>
          <div className="text-sm text-slate-600">Billing date: 15th of month</div>
          <div className="text-sm text-slate-600">Next steps: saved in dashboard</div>
        </div>
      </div>
    </main>
  )
}
