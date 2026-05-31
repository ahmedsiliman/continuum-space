import { useState, useMemo } from 'react';

// ── Shared typography token — mirrors the hint text style in MainScene ────────
const MONO = {
  fontFamily: "'Share Tech Mono', 'Consolas', monospace",
  textTransform: 'uppercase',
  letterSpacing: '3px',
};

// ── Palette ───────────────────────────────────────────────────────────────────
const CYAN       = '#00E5FF';
const CYAN_DIM   = 'rgba(0, 229, 255, 0.6)';
const CYAN_GHOST = 'rgba(0, 229, 255, 0.18)';
const ROW_TEXT   = 'rgba(160, 238, 255, 0.7)';
const SUB_TEXT   = 'rgba(160, 238, 255, 0.45)';
const BG         = 'rgba(2, 4, 10, 0.92)';

/**
 * TelemetryHUD
 *
 * Fixed bottom-left navigation panel styled like spacecraft telemetry readout.
 * Lists all Category nodes; shows their SubCategory children when expanded.
 * Clicking a row calls `onNodeInteract` with the real node object — the same
 * callback used by the force graph, so expand/collapse state is shared.
 *
 * Props
 *   database       — { nodes: [...] }  (same object passed to MainScene)
 *   expandedNodes  — string[]           (same state from App)
 *   onNodeInteract — (node) => void     (same handler from App)
 */
export default function TelemetryHUD({ database, expandedNodes, onNodeInteract }) {
  const [isOpen, setIsOpen] = useState(false);

  const expandedSet = useMemo(() => new Set(expandedNodes || []), [expandedNodes]);

  // All top-level Category nodes
  const categories = useMemo(() => {
    if (!database?.nodes?.length) return [];
    return database.nodes.filter((n) => n.type === 'Category');
  }, [database]);

  // SubCategory nodes grouped by parent id
  const subsByParent = useMemo(() => {
    if (!database?.nodes?.length) return {};
    return database.nodes
      .filter((n) => n.type === 'SubCategory')
      .reduce((acc, n) => {
        (acc[n.parent_id] ??= []).push(n);
        return acc;
      }, {});
  }, [database]);

  // Project nodes grouped by parent id (SubCategory)
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
    <div
      style={{
        position: 'fixed',
        left: 24,
        bottom: 24,
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '8px',
      }}
    >
      {/* ── Panel — slides in above the trigger ──────────────────────────── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isOpen ? '640px' : '0px',
          opacity: isOpen ? 1 : 0,
          transition: 'max-height 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            backgroundColor: BG,
            border: `1px solid ${CYAN_GHOST}`,
            borderLeft: `2px solid rgba(0, 229, 255, 0.35)`,
            backdropFilter: 'blur(8px)',
            minWidth: '240px',
            paddingTop: '4px',
            paddingBottom: '8px',
          }}
        >
          {/* Header */}
          <div
            style={{
              ...MONO,
              color: 'rgba(0, 229, 255, 0.38)',
              fontSize: '9px',
              letterSpacing: '4px',
              padding: '8px 16px 10px',
              borderBottom: `1px solid rgba(0, 229, 255, 0.1)`,
              marginBottom: '4px',
            }}
          >
            NAVIGATION MATRIX
          </div>

          {/* Category rows */}
          {categories.map((cat) => {
            const isExpanded = expandedSet.has(cat.id);
            const subs = subsByParent[cat.id] || [];

            return (
              <div key={cat.id}>
                {/* ── Category row ────────────────────────────────────── */}
                <button
                  onClick={() => onNodeInteract?.(cat)}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.color = '#a0eeff';
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.color = ROW_TEXT;
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: isExpanded ? 'rgba(0, 229, 255, 0.04)' : 'none',
                    border: 'none',
                    borderLeft: isExpanded ? `2px solid ${CYAN}` : '2px solid transparent',
                    color: isExpanded ? CYAN : ROW_TEXT,
                    cursor: 'pointer',
                    padding: '8px 16px 8px 14px',
                    textAlign: 'left',
                    transition: 'color 200ms, border-color 200ms, background 200ms',
                    ...MONO,
                    fontSize: '11px',
                  }}
                >
                  <span>[ {cat.title} ]</span>
                  <span
                    style={{
                      color: isExpanded ? 'rgba(0,229,255,0.55)' : 'rgba(160,238,255,0.22)',
                      marginLeft: '12px',
                      letterSpacing: '2px',
                      fontSize: '9px',
                    }}
                  >
                    {isExpanded ? '── ▴' : '──'}
                  </span>
                </button>

                {/* ── SubCategory rows (shown when parent expanded) ─── */}
                {isExpanded &&
                  subs.map((sub) => {
                    const subExpanded = expandedSet.has(sub.id);
                    const projects = projectsByParent[sub.id] || [];
                    return (
                      <div key={sub.id}>
                        <button
                          onClick={() => onNodeInteract?.(sub)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'rgba(160,238,255,0.85)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = subExpanded
                              ? 'rgba(0,229,255,0.85)'
                              : SUB_TEXT;
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            background: subExpanded ? 'rgba(0,229,255,0.05)' : 'none',
                            border: 'none',
                            borderLeft: subExpanded
                              ? '2px solid rgba(0,229,255,0.5)'
                              : '2px solid transparent',
                            color: subExpanded ? 'rgba(0,229,255,0.85)' : SUB_TEXT,
                            cursor: 'pointer',
                            padding: '5px 16px 5px 30px',
                            textAlign: 'left',
                            transition: 'color 150ms, background 150ms',
                            ...MONO,
                            fontSize: '9px',
                            letterSpacing: '2.5px',
                          }}
                        >
                          <span>· {sub.title}</span>
                          {projects.length > 0 && (
                            <span style={{ color: 'rgba(160,238,255,0.2)', fontSize: '8px', marginLeft: '8px' }}>
                              {subExpanded ? '▾' : '▸'}
                            </span>
                          )}
                        </button>

                        {/* ── Project rows (shown when SubCategory expanded) ── */}
                        {subExpanded &&
                          projects.map((proj) => (
                            <button
                              key={proj.id}
                              onClick={() => onNodeInteract?.(proj)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.background = 'rgba(0,229,255,0.07)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                e.currentTarget.style.background = 'none';
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                borderLeft: '2px solid transparent',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                padding: '4px 16px 4px 48px',
                                textAlign: 'left',
                                transition: 'color 120ms, background 120ms',
                                ...MONO,
                                fontSize: '8px',
                                letterSpacing: '2px',
                              }}
                            >
                              ▷ {proj.title}
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trigger button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,229,255,0.65)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)';
        }}
        style={{
          background: BG,
          border: '1px solid rgba(0,229,255,0.35)',
          color: isOpen ? CYAN : CYAN_DIM,
          ...MONO,
          fontSize: '11px',
          letterSpacing: '4px',
          padding: '7px 16px',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          transition: 'color 200ms, border-color 200ms, box-shadow 200ms',
          boxShadow: isOpen ? '0 0 18px rgba(0,229,255,0.12)' : 'none',
        }}
      >
        [ {isOpen ? 'CLOSE' : 'NAV'} ]
      </button>
    </div>
  );
}
