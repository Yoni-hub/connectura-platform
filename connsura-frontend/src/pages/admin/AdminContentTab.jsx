import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'
import { renderSiteContent } from '../../utils/siteContent'

const contentPages = [
  { slug: 'about_public', label: 'About Us (Public)' },
  { slug: 'privacy_policy', label: 'Privacy Policy' },
  { slug: 'legal_notice', label: 'Legal Notice' },
  { slug: 'careers_intro', label: 'Careers Intro' },
  { slug: 'contact_intro', label: 'Contact Page Intro' },
]

export default function AdminContentTab({ onSessionExpired }) {
  const [contentEntries, setContentEntries] = useState([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [activeContentSlug, setActiveContentSlug] = useState('about_public')
  const [contentWarnings, setContentWarnings] = useState([])

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    toast.error(err?.response?.data?.error || fallbackMessage)
    return false
  }

  const loadContentEntries = async () => {
    setContentLoading(true)
    try {
      const res = await adminApi.get('/admin/site-content')
      setContentEntries(res.data.content || [])
    } catch (err) {
      handleSessionError(err, 'Failed to load site content')
    } finally {
      setContentLoading(false)
    }
  }

  useEffect(() => {
    loadContentEntries()
  }, [])

  useEffect(() => {
    if (!contentEntries.length) return
    const exists = contentEntries.some((entry) => entry.slug === activeContentSlug)
    if (!exists) {
      setActiveContentSlug(contentEntries[0].slug)
    }
  }, [contentEntries, activeContentSlug])

  const updateContentEntry = (slug, patch) => {
    setContentEntries((prev) => prev.map((entry) => (entry.slug === slug ? { ...entry, ...patch } : entry)))
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
      handleSessionError(err, 'Failed to save content')
    } finally {
      setContentSaving(false)
    }
  }

  const contentEntry =
    contentEntries.find((entry) => entry.slug === activeContentSlug) || contentEntries[0] || null
  const contentClasses =
    'prose prose-slate max-w-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed'

  return (
    <div className="space-y-4">
      {contentLoading && <div className="text-slate-500">Loading content...</div>}
      {!contentLoading && !contentEntry && <div className="text-slate-500">No content entries found.</div>}
      {!contentLoading && contentEntry && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {contentPages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  className={`pill-btn-ghost px-4 ${
                    activeContentSlug === page.slug ? 'border-[#0b3b8c] text-[#0b3b8c]' : ''
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
            <div className="text-xs text-slate-500">
              Updated {contentEntry.lastUpdated ? new Date(contentEntry.lastUpdated).toLocaleString() : 'Not yet saved'} by{' '}
              {contentEntry.updatedBy || 'system'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Website Content Manager</div>
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={() => saveContentEntry(contentEntry.slug)}
                disabled={contentSaving}
              >
                {contentSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Title
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={contentEntry.title || ''}
                onChange={(e) => updateContentEntry(contentEntry.slug, { title: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Content (HTML or Markdown-style text)
              <textarea
                className="mt-1 min-h-[260px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                value={contentEntry.content || ''}
                onChange={(e) => updateContentEntry(contentEntry.slug, { content: e.target.value })}
              />
            </label>
          </div>

          {contentWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 space-y-1">
              {contentWarnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-slate-900">Preview</div>
            <div
              className={contentClasses}
              dangerouslySetInnerHTML={{ __html: renderSiteContent(contentEntry.content || '') }}
            />
          </div>
        </>
      )}
    </div>
  )
}
