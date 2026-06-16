import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ImageBlock({ data }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleModal = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <>
      {/* Inline Thumbnail */}
      <div
        onClick={toggleModal}
        style={{
          width: '100%',
          margin: '40px 0',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          cursor: 'zoom-in',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.01)';
          e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
        }}
      >
        <img
          src={data}
          alt="Project Graphic"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {/* Lightbox portaled to document.body — escapes any stacking context
          created by backdrop-filter or transform on parent layout panels */}
      {isOpen && createPortal(
        <div
          onClick={toggleModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            backdropFilter: 'blur(5px)',
          }}
        >
          <img
            src={data}
            alt="Project Graphic Full Size"
            style={{
              maxWidth: '95%',
              maxHeight: '95%',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}