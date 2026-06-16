// src/components/ModuleTransition.jsx
import React, { useEffect, useState } from 'react';

export default function ModuleTransition({ children, originX, originY, onClose, isAboutMe }) {
  const [phase, setPhase] = useState('entering');
  const [isHovered, setIsHovered] = useState(false);

  // Flight target styles (white glass theme)
  const idleStyle = {
    transform: 'translate(calc(100vw - 50px), 30px) translate(-50%, -50%)',
    width: '42px',
    height: '42px',
    background: isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: '50%',
    color: '#ffffff',
    border: isHovered ? '1.5px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: isHovered 
      ? '0 0 20px rgba(255, 255, 255, 0.25), inset 0 0 10px rgba(255, 255, 255, 0.1)' 
      : '0 0 10px rgba(255, 255, 255, 0.05), inset 0 0 5px rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  const initialStyle = {
    transform: `translate(${originX}px, ${originY}px) translate(-50%, -50%)`,
    width: isAboutMe ? '120px' : '44px',
    height: isAboutMe ? '40px' : '44px',
    background: isAboutMe ? 'rgba(10, 10, 12, 0.45)' : '#ffffff',
    borderRadius: isAboutMe ? '12px' : '50%',
    color: 'transparent',
    border: isAboutMe ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
    boxShadow: isAboutMe 
      ? '0 8px 32px 0 rgba(0, 0, 0, 0.25)' 
      : '0 0 30px rgba(255,255,255,1), 0 0 60px rgba(255,255,255,0.2)',
  };

  const [buttonStyle, setButtonStyle] = useState(initialStyle);

  useEffect(() => {
    if (phase === 'idle') {
      setButtonStyle(idleStyle);
    }
  }, [isHovered, phase]);

  useEffect(() => {
    const buttonTimer = setTimeout(() => {
      setButtonStyle(idleStyle);
    }, isAboutMe ? 10 : 50);

    const phaseTimer = setTimeout(() => {
      setPhase('idle');
    }, 950);

    return () => {
      clearTimeout(buttonTimer);
      clearTimeout(phaseTimer);
    };
  }, [originX, originY, isAboutMe]);

  const triggerClose = () => {
    setPhase('closing');
    setButtonStyle(initialStyle);

    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <>
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
          backgroundColor: '#00000080', // 50% transparent black
          backdropFilter: 'blur(2px)',  // Blurs content behind this overlay
          WebkitBackdropFilter: 'blur(2px)', // Required for Safari support
          overflow: 'hidden',
          pointerEvents: phase === 'idle' ? 'auto' : 'none',
          '--origin-x': `${originX}px`,
          '--origin-y': `${originY}px`,
        }}
      >
        {children}
      </div>

      <button
        onClick={triggerClose}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          transition: 'all 1s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease',
          ...buttonStyle,
        }}
      >
        <span
          style={{
            opacity: phase === 'idle' ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            fontSize: '18px',
            fontWeight: '300',
            fontFamily: "'Share Tech Mono', 'Consolas', monospace",
            lineHeight: '1',
            color: '#ffffff',
            textShadow: '0 0 10px rgba(255,255,255,0.8)'
          }}
        >
          ✕
        </span>
      </button>
    </>
  );
}