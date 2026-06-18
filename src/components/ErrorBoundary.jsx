import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div style={{ 
          height: '250px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'rgba(255,255,255,0.4)',
          fontSize: '10px',
          fontFamily: 'monospace',
          letterSpacing: '1px',
          background: 'rgba(255,0,0,0.05)',
          border: '1px dashed rgba(255,0,0,0.2)',
          borderRadius: '12px',
          marginTop: '20px',
          padding: '20px',
          textAlign: 'center'
        }}>
          MAP UNAVAILABLE<br/>
          (Check connection or WebGL)
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
