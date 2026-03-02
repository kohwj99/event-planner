'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '24px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          color: '#171717',
        }}
      >
        <h1 style={{ fontSize: '4rem', fontWeight: 800, color: '#d32f2f', margin: 0 }}>
          Error
        </h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ color: '#666', maxWidth: 480, margin: 0, lineHeight: 1.6 }}>
          A critical error occurred. You can try again or return to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <button
            onClick={reset}
            style={{
              padding: '12px 32px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid #1976d2',
              backgroundColor: 'transparent',
              color: '#1976d2',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              padding: '12px 32px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#1976d2',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </body>
    </html>
  );
}
