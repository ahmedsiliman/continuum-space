import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import './FilterBar.css';

const FilterBar = forwardRef(({ onFilterChange, onSearchChange, onAboutMe, isRadialMode, onRadialModeToggle, activeFilter: externalActiveFilter }, ref) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState(externalActiveFilter || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const searchInputRef = useRef(null);

  // Sync internal activeFilter with external prop if it changes
  useEffect(() => {
    if (externalActiveFilter) setActiveFilter(externalActiveFilter);
  }, [externalActiveFilter]);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    }
  }));

  // Track viewport width so the bar can reserve space for the HUD + details panel
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reserve room: HUD + DetailsPanel on desktop, HUD only on tablet, HUD toggle on phone.
  let reserved;
  if (vw >= 1025)      reserved = 640;   // 280 HUD + 320 panel + 40 gap
  else if (vw >= 769)  reserved = 280;   // 240 HUD + 16+ gap
  else                 reserved = 100;   // 32 HUD-toggle + 16 gap
  const availableWidth = `calc(100vw - ${reserved}px)`;

  const filters = ['All', 'Featured', 'BIM', 'Computational', 'Architecture', 'Urban', 'Art'];

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    onFilterChange?.(filter);
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  return (
    <div className="filter-bar-container" style={{ '--available-width': availableWidth }}>
      {/* Left→Right order: Search | Filter | About Me | Radial Grid */}
      <div className="filter-bar-main">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="SEARCH PROJECTS..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        <button
          className={`filter-toggle-btn ${isFilterExpanded ? 'active' : ''}`}
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
        >
          FILTER {isFilterExpanded ? '−' : '+'}
        </button>

        <button
          className="about-me-btn"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            onAboutMe?.(x, y);
          }}
        >
          ABOUT ME
        </button>

        <button
          className={`radial-toggle-btn-bar ${isRadialMode ? 'active' : ''}`}
          onClick={onRadialModeToggle}
          aria-label={isRadialMode ? 'Switch to dynamic layout' : 'Switch to radial layout'}
          title={isRadialMode ? 'Dynamic layout' : 'Radial layout'}
        >
          {isRadialMode ? '◉' : '○'}
        </button>
      </div>

      {isFilterExpanded && (
        <div className="filter-bar-sub">
          {filters.map((filter) => (
            <button
              key={filter}
              className={`filter-pill ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => handleFilterClick(filter)}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default FilterBar;
