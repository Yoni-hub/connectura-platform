import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (import.meta?.env?.DEV) {
      console.error('ErrorBoundary caught error', error, info)
    }
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info)
    }
  }

  render() {
    const { error } = this.state
    if (error) {
      const showDetails =
        typeof window !== 'undefined' &&
        (import.meta?.env?.DEV ||
          window.location.hostname === 'localhost' ||
          new URLSearchParams(window.location.search).has('debug') ||
          window.localStorage.getItem('debugErrors') === '1')
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ error, showDetails })
      }
      return (
        <div className="surface p-5">
          <div className="text-sm font-semibold text-slate-900">Something went wrong.</div>
          {showDetails && (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-rose-700">
              {String(error?.stack || error?.message || error)}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
