import React, { useState } from 'react';
import './FilterBar.css';

const FilterBar = ({ onFilterChange, onSearchChange, onAboutMe }) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="filter-bar-container">
      {/* Left→Right order: Search | Filter | About Me */}
      <div className="filter-bar-main">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
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
};

export default FilterBar;