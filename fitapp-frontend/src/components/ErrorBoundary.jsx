import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('❌ ErrorBoundary caught an error:', error)
    console.error('❌ Error info:', errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
          <div className="card w-full max-w-md p-8 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4.5M12 16h.01" />
              </svg>
            </span>
            <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-muted">The app hit an error. Try refreshing the page.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button onClick={() => window.location.reload()} className="btn btn-primary">
                Refresh
              </button>
              <button
                onClick={() => {
                  window.location.href = '/login'
                }}
                className="btn btn-secondary"
              >
                Go to login
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-ink-muted">Error details (development only)</summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-surface-2 p-3 text-xs text-ink">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

