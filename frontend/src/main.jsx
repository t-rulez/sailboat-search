import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Fanger alle React-feil og viser en lesbar melding i stedet for blank side
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', color: '#e8d5b0', background: '#0a1628',
          minHeight: '100vh', fontFamily: 'monospace', fontSize: '0.9rem'
        }}>
          <h2 style={{ color: '#d4a017' }}>⚓ Noe gikk galt</h2>
          <p>Prøv å laste siden på nytt.</p>
          <pre style={{ opacity: 0.6, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem', padding: '0.6rem 1.2rem',
              background: '#162d58', border: '1px solid #d4a017',
              color: '#e8d5b0', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            Last inn på nytt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
