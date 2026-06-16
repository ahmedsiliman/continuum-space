import React from 'react';

const SceneLink = ({ link, linkElementsRef }) => {
  return (
    <path
      ref={(el) => {
        if (!el) {
          delete linkElementsRef.current[link.id];
          return;
        }
        linkElementsRef.current[link.id] = el;
      }}
      d=""
      fill="none"
      stroke={`hsla(${link.parentHue}, ${link.childType === 'Project' ? '40%' : '60%'}, ${link.childType === 'Project' ? '70%' : '80%'}, ${link.childType === 'Project' ? '0.15' : '0.22'})`}
      strokeWidth={link.childType === 'Project' ? '1' : '1.2'}
      strokeLinecap="round"
      style={{ transition: 'opacity 180ms ease' }}
    />
  );
};

export default SceneLink;
