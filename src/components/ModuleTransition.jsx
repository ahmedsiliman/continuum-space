// src/components/ModuleTransition.jsx
import React, { useEffect, useState } from 'react';

export default function ModuleTransition({ children, originX, originY, onClose }) {
  const [phase, setPhase] = useState('entering');

  // Initial state: the exact glowing white node from the universe
  const [buttonStyle, setButtonStyle] = useState({
    transform: `translate(${originX}px, ${originY}px) translate(-50%, -50%)`,
    width: '44px',
    height: '44px',
    background: '#ffffff',
    borderRadius: '50%',
    color: 'transparent',
    border: '1px solid transparent',
    boxShadow: '0 0 30px rgba(255,255,255,1), 0 0 60px #00E5FF, inset 0 0 10px #0088FF',
  });

  useEffect(() => {
    // Start button flight after 50ms (initial white-node state needs one frame to render)
    const buttonTimer = setTimeout(() => {
      setButtonStyle({
        transform: 'translate(calc(100vw - 40px), 40px) translate(-50%, -50%)',
        width: '44px',
        height: '44px',
        background: '#02040a',
        borderRadius: '50%',
        color: '#00E5FF',
        border: '1px solid rgba(0, 229, 255, 0.4)',
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.3), inset 0 0 15px rgba(0,0,0,1)',
      });
    }, 50);

    // Let bubble-expand animation run its full 900ms before going idle
    const phaseTimer = setTimeout(() => {
      setPhase('idle');
    }, 950);

    return () => {
      clearTimeout(buttonTimer);
      clearTimeout(phaseTimer);
    };
  }, [originX, originY]);

  // Reverse flight: void halo → universe node → unmount
  const triggerClose = () => {
    setPhase('closing');
    setButtonStyle({
      transform: `translate(${originX}px, ${originY}px) translate(-50%, -50%)`,
      width: '44px',
      height: '44px',
      background: '#ffffff',
      borderRadius: '50%',
      color: 'transparent',
      border: '1px solid transparent',
      boxShadow: '0 0 30px rgba(255,255,255,1), 0 0 60px #00E5FF, inset 0 0 10px #0088FF',
    });

    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <>
      {/* Layer 1: Expanding / collapsing background bubble */}
      <div
        className={
          phase === 'entering' ? 'bubble-transition-dynamic' :
          phase === 'closing'  ? 'bubble-transition-reverse' : ''
        }
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 100,
          backgroundColor: '#02040a',
          overflow: 'hidden',
          pointerEvents: phase === 'idle' ? 'auto' : 'none',
          '--origin-x': `${originX}px`,
          '--origin-y': `${originY}px`,
        }}
      >
        {children}
      </div>

      {/* Layer 2: Morphing flight button */}
      <button
        onClick={triggerClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 101,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: phase === 'idle' ? 'pointer' : 'default',
          pointerEvents: phase === 'idle' ? 'auto' : 'none',
          transition: 'all 1s cubic-bezier(0.25, 1, 0.5, 1)',
          ...buttonStyle,
        }}
      >
        <span
          style={{
            opacity: phase === 'idle' ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            fontSize: '18px',
            fontWeight: '300',
            fontFamily: 'sans-serif',
            lineHeight: '1',
            marginTop: '2px',
          }}
        >
          ✕
        </span>
      </button>
    </>
  );
}