import { Suspense } from 'react';
import './ProjectDetailsPanel.css';
import GlobeMap from './GlobeMap';
import ErrorBoundary from './ErrorBoundary';

const ProjectDetailsPanel = ({ details, isOpen, onToggle }) => {
  if (!details && !isOpen) return null;

  return (
    <div className={`project-details-panel ${isOpen ? 'open' : 'collapsed'}`}>
      <button className="toggle-button" onClick={onToggle}>
        {isOpen ? '»' : '«'}
      </button>
      
      {isOpen && (
        <div className="panel-content-wrapper" key={details?.node_id || 'empty'}>
          {details ? (
            <div className="panel-content">
              {details.title && <h2 className="panel-title">{details.title}</h2>}

              {(details.image_url || details.location) && (
                <div className="panel-media-row">
                  {details.image_url && (
                    <div className="panel-image-container">
                      <img src={details.image_url} alt={details.title} className="panel-image" />
                    </div>
                  )}

                  {details.location && (
                    <ErrorBoundary>
                      <Suspense fallback={
                        <div className="panel-globe-fallback">LOADING GEODATA…</div>
                      }>
                        <GlobeMap location={details.location} />
                      </Suspense>
                    </ErrorBoundary>
                  )}
                </div>
              )}

              {details.description && (
                <div className="panel-description">
                  <p>{details.description}</p>
                </div>
              )}

              {details.address && (
                <div className="panel-address">
                  <span className="address-icon">📍</span>
                  <span className="address-text">{details.address}</span>
                </div>
              )}

              {!details.title && !details.image_url && !details.description && !details.location && (
                <p className="no-data">No details available for this node.</p>
              )}
            </div>
          ) : (
            <div className="panel-content">
              <p className="no-data">Select a node to view details.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsPanel;
