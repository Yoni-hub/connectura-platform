import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { API_URL, api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getStoredToken } from '../utils/authStorage'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'

const MAX_BODY_LENGTH = 4000
const TIMESTAMP_GAP_MS = 10 * 60 * 1000
const NEAR_BOTTOM_PX = 120
const MAX_RENDER_CHARS = 1200
const LINK_REGEX = /(https?:\/\/[^\s]+)/g

const getInitials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return 'CU'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const formatTimestamp = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const formatTimeOnly = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const linkifyText = (text, keyPrefix = '') => {
  if (!text) return null
  const parts = String(text).split(LINK_REGEX)
  return parts.map((part, index) => {
    if (!part) return null
    if (part.match(LINK_REGEX)) {
      return (
        <a
          key={`${keyPrefix}-link-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-[#0b3b8c] underline break-words [overflow-wrap:anywhere]"
        >
          {part}
        </a>
      )
    }
    return (
      <span key={`${keyPrefix}-text-${index}`} className="break-words [overflow-wrap:anywhere]">
        {part}
      </span>
    )
  })
}

const truncateMessage = (value) => {
  const text = String(value || '')
  if (text.length <= MAX_RENDER_CHARS) {
    return { text, truncated: false }
  }
  const trimmed = text.slice(0, MAX_RENDER_CHARS).trimEnd()
  return { text: `${trimmed}...`, truncated: true }
}

export default function Messages({ embedded = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [showJump, setShowJump] = useState(false)
  const [isDesktop, setIsDesktop] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  )

  const socketRef = useRef(null)
  const scrollRef = useRef(null)
  const nearBottomRef = useRef(true)
  const lastMessageIdRef = useRef(null)
  const conversationsRef = useRef([])

  const routeConversationId = params.conversationId ? Number(params.conversationId) : null
  const queryConversationId = useMemo(() => {
    const search = new URLSearchParams(location.search)
    const value = Number(search.get('conversationId'))
    return Number.isFinite(value) && value > 0 ? value : null
  }, [location.search])
  const resolvedConversationId = routeConversationId || (embedded ? queryConversationId : null)

  const clearBootstrapParams = (params) => {
    params.delete('agent')
    params.delete('client')
    params.delete('customer')
  }

  const navigateToConversation = (conversationId, options = {}) => {
    if (!conversationId) return
    if (embedded) {
      const params = new URLSearchParams(location.search)
      clearBootstrapParams(params)
      params.set('tab', 'messages')
      params.set('conversationId', String(conversationId))
      navigate(`${location.pathname}?${params.toString()}`, options)
      return
    }
    navigate(`/messages/${conversationId}`, options)
  }

  const navigateToList = (options = {}) => {
    if (embedded) {
      const params = new URLSearchParams(location.search)
      clearBootstrapParams(params)
      params.set('tab', 'messages')
      params.delete('conversationId')
      navigate(`${location.pathname}?${params.toString()}`, options)
      return
    }
    navigate('/messages', options)
  }

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversationId === activeConversationId) || null,
    [conversations, activeConversationId]
  )

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((item) => {
      const haystack = `${item.otherPartyName} ${item.lastMessageSnippet || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [conversations, search])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const res = await api.get('/api/messages/conversations')
      setConversations(res.data?.conversations || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId, cursorValue = null) => {
    if (!conversationId) return
    setMessagesLoading(true)
    try {
      const res = await api.get(`/api/messages/conversations/${conversationId}/messages`, {
        params: {
          cursor: cursorValue || undefined,
          limit: 30,
        },
      })
      const payload = Array.isArray(res.data?.messages) ? res.data.messages : []
      const ordered = [...payload].reverse()
      if (cursorValue) {
        setMessages((prev) => [...ordered, ...prev])
      } else {
        setMessages(ordered)
      }
      setNextCursor(res.data?.nextCursor || null)
      setHasMore(Boolean(res.data?.nextCursor))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const markRead = async (conversationId) => {
    if (!conversationId) return
    try {
      await api.post(`/api/messages/conversations/${conversationId}/read`)
      setConversations((prev) =>
        prev.map((item) =>
          item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item
        )
      )
    } catch {
      // Ignore read errors
    }
  }

  const appendMessage = (incoming) => {
    if (!incoming?.id) return
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === incoming.id)) return prev
      return [...prev, incoming]
    })
  }

  const updateConversationPreview = (conversationId, message) => {
    setConversations((prev) => {
      const next = prev.map((item) => {
        if (item.conversationId !== conversationId) return item
        return {
          ...item,
          lastMessageSnippet: message.body?.slice(0, 120) || '',
          lastMessageAt: message.createdAt,
        }
      })
      next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      return next
    })
  }

  const handleSend = async () => {
    const trimmed = composer.trim()
    if (!trimmed) return
    if (!activeConversationId) {
      toast.error('Select a conversation first')
      return
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      toast.error(`Message must be under ${MAX_BODY_LENGTH} characters`)
      return
    }
    setSending(true)
    try {
      const res = await api.post(`/api/messages/conversations/${activeConversationId}/messages`, {
        body: trimmed,
      })
      const message = res.data?.message
      if (message) {
        appendMessage(message)
        updateConversationPreview(activeConversationId, message)
        lastMessageIdRef.current = message.id
      }
      setComposer('')
      nearBottomRef.current = true
      setShowJump(false)
      markRead(activeConversationId)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!sending) handleSend()
    }
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distance < NEAR_BOTTOM_PX
    nearBottomRef.current = nearBottom
    if (nearBottom) {
      setShowJump(false)
    }
  }

  const jumpToLatest = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setShowJump(false)
    nearBottomRef.current = true
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (resolvedConversationId) {
      setActiveConversationId(resolvedConversationId)
      loadMessages(resolvedConversationId)
      markRead(resolvedConversationId)
    }
  }, [resolvedConversationId])

  useEffect(() => {
    if (!resolvedConversationId && conversations.length && !activeConversationId) {
      setActiveConversationId(conversations[0].conversationId)
    }
  }, [conversations, resolvedConversationId, activeConversationId])

  useEffect(() => {
    if (!activeConversationId || resolvedConversationId) return
    loadMessages(activeConversationId)
    markRead(activeConversationId)
  }, [activeConversationId, resolvedConversationId])

  useEffect(() => {
    if (!user) return
    const token = getStoredToken()
    const socket = io(API_URL, {
      auth: token ? { token } : undefined,
      withCredentials: true,
    })
    socketRef.current = socket

    socket.on('message:new', ({ conversationId, message }) => {
      const exists = conversationsRef.current.some((item) => item.conversationId === conversationId)
      if (!exists) {
        loadConversations()
      }
      updateConversationPreview(conversationId, message)
      if (conversationId === activeConversationId) {
        appendMessage(message)
        markRead(conversationId)
      } else {
        setConversations((prev) =>
          prev.map((item) =>
            item.conversationId === conversationId
              ? { ...item, unreadCount: (item.unreadCount || 0) + 1 }
              : item
          )
        )
      }
    })

    socket.on('conversation:updated', ({ conversationId, lastMessageAt }) => {
      if (!conversationId) return
      setConversations((prev) =>
        prev.map((item) =>
          item.conversationId === conversationId ? { ...item, lastMessageAt } : item
        )
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [user, activeConversationId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (messages.length === 0) return
    const lastId = messages[messages.length - 1]?.id
    if (lastId && lastId === lastMessageIdRef.current) return
    lastMessageIdRef.current = lastId
    if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight
      setShowJump(false)
    } else {
      setShowJump(true)
    }
  }, [messages])

  useEffect(() => {
    if (!user) return
    const paramsSearch = new URLSearchParams(location.search)
    const agentId = paramsSearch.get('agent')
    const clientId = paramsSearch.get('client') || paramsSearch.get('customer')
    const shouldCreate =
      (user.role === 'CUSTOMER' && agentId) || (user.role === 'AGENT' && clientId)
    if (!shouldCreate) return

    const createConversation = async () => {
      try {
        const res = await api.post('/api/messages/conversations', {
          agentId: user.role === 'CUSTOMER' ? agentId : undefined,
          clientId: user.role === 'AGENT' ? clientId : undefined,
        })
        const conversationId = res.data?.conversationId
        if (conversationId) {
          socketRef.current?.emit('conversation:join', { conversationId })
          navigateToConversation(conversationId, { replace: true })
          loadConversations()
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Unable to start conversation')
      }
    }

    createConversation()
  }, [location.search, user, navigate])

  const handleSelectConversation = (conversationId) => {
    if (!conversationId) return
    if (embedded) {
      navigateToConversation(conversationId)
    } else if (!isDesktop) {
      navigate(`/messages/${conversationId}`)
    } else {
      setActiveConversationId(conversationId)
    }
    markRead(conversationId)
  }

  const threadVisible = resolvedConversationId || isDesktop
  const roleCopy =
    user?.role === 'AGENT'
      ? 'Chat one-on-one with your connected client.'
      : 'Chat one-on-one with your connected agent.'

  const listHeightClass = embedded
    ? 'max-h-[calc(100vh-260px)] lg:max-h-[70vh]'
    : 'max-h-[calc(100vh-190px)] lg:max-h-[70vh]'
  const threadHeightClass = embedded
    ? 'min-h-[calc(100vh-260px)] lg:min-h-[520px]'
    : 'min-h-[calc(100vh-190px)] lg:min-h-[520px]'
  const containerClass = embedded ? 'w-full' : 'mx-auto max-w-6xl'
  const shellClass = embedded ? 'bg-transparent' : 'bg-slate-50'
  const shellPadding = embedded ? '' : 'px-3 sm:px-4 py-4 lg:py-6'
  const headingSpacing = embedded ? 'mb-2' : 'mb-3'
  const hideListOnMobile = resolvedConversationId && !isDesktop

  const content = (
    <div className={`${containerClass} ${shellPadding}`}>
      <div className={`${headingSpacing} flex flex-wrap items-center justify-between gap-2`}>
          <div>
            <p className="text-sm text-slate-500">{roleCopy}</p>
          </div>
          <button
            type="button"
            className="pill-btn-ghost px-4"
            onClick={loadConversations}
            disabled={loadingConversations}
          >
            {loadingConversations ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <div
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${
              hideListOnMobile ? 'hidden lg:block' : ''
            }`}
          >
            <div className="border-b border-slate-100 p-3">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search conversations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className={`${listHeightClass} overflow-y-auto overflow-x-hidden p-2`}>
              {loadingConversations && <Skeleton className="h-24" />}
              {!loadingConversations && filteredConversations.length === 0 && (
                <div className="p-4 text-sm text-slate-500">
                  No conversations yet. Share your profile with an agent to start messaging.
                </div>
              )}
              {!loadingConversations &&
                filteredConversations.map((item) => {
                  const isActive = item.conversationId === activeConversationId
                  return (
                    <button
                      key={item.conversationId}
                      type="button"
                      onClick={() => handleSelectConversation(item.conversationId)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition overflow-hidden ${
                        isActive ? 'bg-[#e8f0ff]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 grid place-items-center font-semibold">
                        {getInitials(item.otherPartyName)}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-full">
                              {item.otherPartyName}
                            </div>
                            <Badge label={item.otherPartyRole} tone="blue" />
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatTimeOnly(item.lastMessageAt)}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 truncate max-w-full">
                            {item.lastMessageSnippet || 'Start the conversation'}
                          </div>
                          {item.unreadCount > 0 && (
                            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                              {item.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>

          <div
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col ${threadHeightClass} ${
              threadVisible ? '' : 'hidden lg:flex'
            }`}
          >
            {activeConversation ? (
              <>
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">
                        {activeConversation.otherPartyName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Badge label={activeConversation.otherPartyRole} tone="gray" />
                        <span>{activeConversation.otherPartyEmail || 'Connected user'}</span>
                      </div>
                    </div>
                    {(routeConversationId || (embedded && resolvedConversationId && !isDesktop)) && (
                      <button
                        type="button"
                        className="pill-btn-ghost px-4 lg:hidden"
                        onClick={() => navigateToList()}
                      >
                        Back
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="flex-1 w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden bg-slate-50 px-4 py-4"
                  ref={scrollRef}
                  onScroll={handleScroll}
                >
                  {messagesLoading && <Skeleton className="h-20" />}
                  {!messagesLoading && messages.length === 0 && (
                    <div className="text-sm text-slate-500">No messages yet. Say hello!</div>
                  )}
                  {!messagesLoading &&
                    messages.map((message, index) => {
                      const prev = messages[index - 1]
                      const sameSender = prev?.senderId === message.senderId
                      const showTimestamp =
                        !prev || new Date(message.createdAt) - new Date(prev.createdAt) > TIMESTAMP_GAP_MS
                      const isOwn = user?.role === message.senderRole
                          const { text: displayBody } = truncateMessage(message.body)
                          return (
                            <div key={message.id} className={sameSender ? 'mt-1' : 'mt-3'}>
                              {showTimestamp && (
                                <div className="mb-2 text-center text-[11px] text-slate-400">
                                  {formatTimestamp(message.createdAt)}
                                </div>
                              )}
                              <div className={`flex w-full min-w-0 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[85%] sm:max-w-[78%] min-w-0 overflow-hidden rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] break-words shadow-sm ${
                                    isOwn ? 'bg-[#0b3b8c] text-white' : 'bg-white text-slate-800 border border-slate-100'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-1 break-words [overflow-wrap:anywhere]">
                                    {String(displayBody || '')
                                      .split('\n')
                                      .map((line, lineIndex) => (
                                        <div key={`${message.id}-line-${lineIndex}`}>
                                          {linkifyText(line, `${message.id}-${lineIndex}`) || '\u00A0'}
                                        </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {showJump && (
                    <div className="sticky bottom-4 flex justify-center">
                      <button
                        type="button"
                        className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow-lg"
                        onClick={jumpToLatest}
                      >
                        Jump to latest
                      </button>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 border-t border-slate-100 bg-white p-3">
                  {hasMore && (
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:text-slate-700 mb-2"
                      onClick={() => loadMessages(activeConversationId, nextCursor)}
                      disabled={messagesLoading}
                    >
                      {messagesLoading ? 'Loading...' : 'Load older messages'}
                    </button>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px] max-h-[140px]"
                      placeholder="Write a message..."
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                    />
                    <button
                      type="button"
                      className="pill-btn-primary px-5"
                      onClick={handleSend}
                      disabled={sending}
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Press Enter to send, Shift+Enter for a new line.
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                Select a conversation to start chatting.
              </div>
            )}
          </div>
        </div>
    </div>
  )

  return embedded ? (
    <div className={`overflow-x-hidden ${shellClass}`}>{content}</div>
  ) : (
    <main className={`min-h-screen overflow-x-hidden ${shellClass}`}>{content}</main>
  )
}
