import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portfolio ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '4rem auto',
          fontFamily: 'sans-serif',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#e11d48' }}>Something went wrong</h2>
          <p style={{ color: '#4b5563' }}>An error occurred while loading the 3D portfolio:</p>
          <pre style={{
            background: '#f3f4f6',
            padding: '1rem',
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '0.85rem'
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Console signature ---
if (typeof window !== 'undefined') {
  console.log('%c Natnael Zerihun %c Portfolio', 'background:#111;color:#fff;padding:4px 8px;font-weight:bold;', 'background:#8B5CF6;color:#fff;padding:4px 8px;font-weight:bold;');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
