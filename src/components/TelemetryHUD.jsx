import { useMemo, useState, useEffect } from 'react';
import './TelemetryHUD.css';

// ── Typography Token ─────────────────────────────────────────────────────────
const MONO = {
  fontFamily: "'Share Tech Mono', 'Consolas', monospace",
  textTransform: 'uppercase',
  letterSpacing: '2px',
};

// ── Modern Monochrome Glass Palette ──────────────────────────────────────────
const TEXT_MAIN   = 'rgba(255, 255, 255, 0.9)';
const TEXT_MUTED  = 'rgba(255, 255, 255, 0.5)';
const TEXT_DARK   = 'rgba(255, 255, 255, 0.25)';
const ROW_ACTIVE  = 'rgba(255, 255, 255, 0.06)';

export default function TelemetryHUD({ database, expandedNodes, onNodeInteract, onNodeFocus, onAboutMe }) {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1024);
  
  // Handle auto-collapse on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const expandedSet = useMemo(() => new Set(expandedNodes || []), [expandedNodes]);

  const categories = useMemo(() => {
    if (!database?.nodes?.length) return [];
    return database.nodes.filter((n) => n.type === 'Category');
  }, [database]);

  const subsByParent = useMemo(() => {
    if (!database?.nodes?.length) return {};
    return database.nodes
      .filter((n) => n.type === 'SubCategory')
      .reduce((acc, n) => {
        (acc[n.parent_id] ??= []).push(n);
        return acc;
      }, {});
  }, [database]);

  const projectsByParent = useMemo(() => {
    if (!database?.nodes?.length) return {};
    return database.nodes
      .filter((n) => n.type === 'Project')
      .reduce((acc, n) => {
        (acc[n.parent_id] ??= []).push(n);
        return acc;
      }, {});
  }, [database]);

  return (
    <>
      <button 
        className="hud-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title="Toggle Index"
      >
        {isCollapsed ? '☰' : '✕'}
      </button>

      <div className={`telemetry-hud-container ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="hud-glass-content">
          {/* About Me entry — shown only on mobile (≤1024px) via CSS */}
          {onAboutMe && (
            <button
              className="hud-about-row"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onAboutMe(rect.left + rect.width / 2, rect.top + rect.height / 2);
              }}
            >
              <span className="hud-about-icon" aria-hidden="true">◐</span>
              <span>About Me</span>
            </button>
          )}

          {/* Header */}
          <div
            style={{
              ...MONO,
              color: TEXT_DARK,
              fontSize: '11px',
              letterSpacing: '3px',
              padding: '16px 20px 12px 20px',
              borderBottom: `1px solid rgba(255, 255, 255, 0.05)`,
              marginBottom: '6px',
            }}
          >
            CONTINUUM INDEX
          </div>

          {/* Category rows */}
          {categories.map((cat) => {
            const isExpanded = expandedSet.has(cat.id);
            const subs = subsByParent[cat.id] || [];

            return (
              <div key={cat.id}>
                {/* Category row */}
                <button
                  className="hud-row"
                  onClick={() => onNodeInteract?.(cat)}
                  onMouseEnter={() => onNodeFocus?.(cat)}
                  onMouseLeave={() => onNodeFocus?.(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: isExpanded ? ROW_ACTIVE : 'none',
                    border: 'none',
                    color: isExpanded ? TEXT_MAIN : TEXT_MUTED,
                    cursor: 'pointer',
                    padding: '12px 20px',
                    textAlign: 'left',
                    ...MONO,
                    fontSize: '12px',
                    fontWeight: isExpanded ? '600' : '400',
                  }}
                >
                  <span>{cat.title}</span>
                  <span
                    style={{
                      color: isExpanded ? TEXT_MAIN : TEXT_DARK,
                      fontSize: '8px',
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 150ms ease',
                    }}
                  >
                    {isExpanded ? '■' : '□'}
                  </span>
                </button>

                {/* SubCategory rows */}
                {isExpanded &&
                  subs.map((sub) => {
                    const subExpanded = expandedSet.has(sub.id);
                    const projects = projectsByParent[sub.id] || [];
                    return (
                      <div key={sub.id} style={{ position: 'relative' }}>
                        {/* Sub-level structural indicator line */}
                        <div style={{
                          position: 'absolute',
                          left: '24px',
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)'
                        }}/>

                        <button
                          className="hud-row"
                          onClick={() => onNodeInteract?.(sub)}
                          onMouseEnter={() => onNodeFocus?.(sub)}
                          onMouseLeave={() => onNodeFocus?.(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            background: subExpanded ? ROW_ACTIVE : 'none',
                            border: 'none',
                            color: subExpanded ? TEXT_MAIN : TEXT_MUTED,
                            cursor: 'pointer',
                            padding: '8px 20px 8px 36px',
                            textAlign: 'left',
                            ...MONO,
                            fontSize: '11px',
                          }}
                        >
                          <span>{sub.title}</span>
                          {projects.length > 0 && (
                            <span style={{ color: subExpanded ? TEXT_MUTED : TEXT_DARK, fontSize: '7px' }}>
                              {subExpanded ? '●' : '○'}
                            </span>
                          )}
                        </button>

                        {/* Project rows */}
                        {subExpanded &&
                          projects.map((proj) => (
                            <div key={proj.id} style={{ position: 'relative' }}>
                              {/* Nested structural indicator line */}
                              <div style={{
                                position: 'absolute',
                                left: '42px',
                                top: 0,
                                bottom: 0,
                                width: '1px',
                                backgroundColor: 'rgba(255, 255, 255, 0.04)'
                              }}/>

                              <button
                                className="hud-row"
                                onClick={() => onNodeInteract?.(proj)}
                                onMouseEnter={() => onNodeFocus?.(proj)}
                                onMouseLeave={() => onNodeFocus?.(null)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  background: 'none',
                                  border: 'none',
                                  color: TEXT_DARK,
                                  cursor: 'pointer',
                                  padding: '6px 20px 6px 54px',
                                  textAlign: 'left',
                                  ...MONO,
                                  fontSize: '10px',
                                  letterSpacing: '1px',
                                }}
                              >
                                {proj.title}
                              </button>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}