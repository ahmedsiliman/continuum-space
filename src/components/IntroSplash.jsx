import { useState } from 'react';
import './IntroSplash.css';

const ANIMATION_DURATION = 900; // ms — must match bubble-collapse duration in IntroSplash.css

export default function IntroSplash({ site, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClick = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(onDismiss, ANIMATION_DURATION);
  };

  return (
    <div
      className={`intro-splash${isExiting ? ' exit' : ''}`}
      onClick={handleClick}
    >
      <div className="intro-content">
        <h1 className="intro-name">{site?.name}</h1>
        <div className="intro-divider" />
        <p className="intro-tagline">{site?.tagline}</p>
        <p className="intro-prompt">[ click anywhere to enter ]</p>
      </div>
    </div>
  );
}
