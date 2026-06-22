import React from 'react';
import { getNodeColor, getGlowColor } from './MainSceneUtils';

// ── DEBUG TOGGLES ─────────────────────────────────────────────────────────
// drop-shadow vs box-shadow question is settled (drop-shadow wins). These
// two remain useful if intensity still looks off on dimmed/filtered nodes.
const DEBUG_DISABLE_WRAPPER_FILTER = false; // kills grayscale/blur on dimmed wrapper
const DEBUG_FORCE_HIGHLIGHTED = false;      // forces isHighlighted=true regardless of filter/search
// ─────────────────────────────────────────────────────────────────────────

const SceneNode = React.memo(({ 
  node, 
  isExpanded, 
  expandable,
  onPointerDown, 
  onNodeFocus,
  nodeElementsRef,
  nodeDotRef, 
  nodeLabelRef, 
  progressArcRef, 
  scale,
  activeFilter = 'All',
  searchQuery = ''
}) => {
  const isProject = node.type === 'Project';
  const nodeFilters = node.filter ? node.filter.split(',').map(f => f.trim().toLowerCase()) : [];
  const activeFilterLower = activeFilter.toLowerCase();

  const matchesFilter = activeFilter === 'All' || nodeFilters.includes(activeFilterLower);
  const matchesSearch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery.toLowerCase());

  let isHighlighted = matchesFilter && matchesSearch;
  if (DEBUG_FORCE_HIGHLIGHTED) isHighlighted = false; // For debugging purposes, force all nodes to be highlighted
  const isDimmed = !isHighlighted;

  return (
    <div
      ref={(el) => {
        if (!el) {
          delete nodeElementsRef.current[node.id];
          return;
        }
        nodeElementsRef.current[node.id] = el;
        const screenX = window.innerWidth / 2 + node.x;
        const screenY = window.innerHeight / 2 + node.y;
        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
      }}
      data-node-id={node.id}
      style={{
        position: 'absolute', top: 0, left: 0, display: 'flex', flexDirection: 'column', 
        alignItems: 'center',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        transition: 'filter 400ms ease, opacity 400ms ease',
        opacity: isDimmed ? 0.25 : 1,
        // theory #4: this wrapper-level filter desaturates/blurs EVERYTHING inside,
        // including any glow you add below, whenever the node is dimmed.
        filter: (isDimmed && !DEBUG_DISABLE_WRAPPER_FILTER) ? 'grayscale(1) blur(1px)' : 'none',
        pointerEvents: isDimmed ? 'none' : 'auto',
        zIndex: isHighlighted ? 10 : 1
      }}
      onDragStart={(e) => e.preventDefault()} 
      onPointerDown={(e) => onPointerDown(e, node)}
      onPointerEnter={() => onNodeFocus?.(node)}
      onPointerLeave={() => onNodeFocus?.(null)}
    >

      {/* ── Main Smoked Glass Node ──────────────────────────────────────────── */}
      <div
        ref={(el) => { if (el) nodeDotRef.current[node.id] = el; else delete nodeDotRef.current[node.id]; }}
        style={{
          position: 'relative',
          width: `${node.nodeRadius * 2}px`,
          height: `${node.nodeRadius * 2}px`,

          // RESTING FILL: saturation bumped 12% -> 38% (theory #3) so the glow
          // isn't fighting a near-grey disc for chroma. Expanded branch untouched.
          backgroundColor: isExpanded
            ? `hsla(${node.hue}, 55%, 28%, 0.55)`
            : `hsla(${node.hue}, 38%, 62%, 0.65)`,

          borderRadius: '50%',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',

          // RESTING GLOW — confirmed via testing that box-shadow gets dulled when
          // combined with backdropFilter on this element, so the glow now lives
          // on `filter: drop-shadow()` instead, which composites after backdrop
          // sampling and renders with full intensity.
          // inset shadow is kept on box-shadow since drop-shadow can't do insets.
          boxShadow: isExpanded
            ? `0 0 22px hsla(${node.hue}, 100%, 65%, 0.60), 0 0 48px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 0 22px hsla(${node.hue}, 100%, 60%, 0.22), inset 0 1px 2px rgba(255,255,255,0.18)`
            : `inset 0 0 16px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 1px 1px rgba(255,255,255,0.18)`,

          // Two stacked drop-shadows: a tight hot core + a wider soft halo.
          // This is what actually renders with punch (per your test).
          filter: isExpanded
            ? 'none'
            : `drop-shadow(0 0 3px hsla(${node.hue}, 100%, 10%, 0.5)) drop-shadow(0 0 10px hsla(${node.hue}, 100%, 50%, 0.4))`,

          // RESTING BORDER — this is a SEPARATE property from both box-shadow and
          // filter, so neither glow change above touches it. It was the flat/washed
          // part you noticed. Intensified directly: alpha near-opaque, width thickened
          // slightly (still less than expanded's 1.5px so the two states stay distinct).
          // Added a thin outline as a cheap second ring for extra presence.
          border: `1.25px solid hsla(${node.hue}, 100%, 72%, 0.98)`,
            outline: isExpanded ? 'none' : `1px solid hsla(${node.hue}, 100%, 60%, 0.55)`,


          transform: isExpanded ? 'scale(1.06)' : 'scale(1)',
          transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Project Specific Tracking Rings */}
        {node.type === 'Project' && (
          <svg width="60" height="60" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', overflow: 'visible', pointerEvents: 'none' }}>
            <circle cx="30" cy="30" r="20" fill="none" stroke={`hsla(${node.hue}, 100%, 65%, 0.05)`} strokeWidth="1" />
            <circle
              ref={(el) => { if (el) progressArcRef.current[node.id] = el; else delete progressArcRef.current[node.id]; }}
              cx="30" cy="30" r="20" fill="none" 
              stroke={`hsla(${node.hue}, 100%, 65%, ${isExpanded ? 0.75 : 0.45})`}
              strokeWidth="1.5" 
              strokeDasharray={String(2 * Math.PI * 20)} 
              strokeDashoffset={String(2 * Math.PI * 20)}
              strokeLinecap="round" 
              transform="rotate(-90 30 30)"
              style={{ transition: 'stroke 250ms ease' }}
            />
          </svg>
        )}

        {/* Central Core Element */}
        <div style={{
          width: '1%',
          height: '1%',
          borderRadius: '50%',
          backgroundColor: isExpanded ? '#ffffff' : `hsla(${node.hue}, 100%, 65%, 0.85)`,
          boxShadow: isExpanded 
            ? '0 0 12px #ffffff' 
            : `0 0 14px hsla(${node.hue}, 100%, 65%, 0.75)`,
          transition: 'background-color 250ms ease, box-shadow 250ms ease, transform 250ms ease',
          transform: isExpanded ? 'scale(1.1)' : 'scale(1)',
        }} />
      </div>

      {/* ── Minimalist Sub-Action Indicator ─────────────────────────────────── */}
      {expandable && node.type !== 'Project' && (
        <div
          style={{
            marginTop: '10px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: isExpanded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.45)',
            fontFamily: "'Share Tech Mono', 'Consolas', monospace",
            fontSize: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            backgroundColor: 'rgba(10, 10, 12, 0.35)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.05)',
            transition: 'all 200ms ease'
          }}
        >
          {isExpanded ? '■' : '□'}
        </div>
      )}

      {/* ── Monochrome Text Label ──────────────────────────────────────────── */}
      <span
        ref={(el) => { if (el) nodeLabelRef.current[node.id] = el; else delete nodeLabelRef.current[node.id]; }}
        style={{
          fontFamily: "'Share Tech Mono', 'Consolas', monospace",
          color: isExpanded ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)',
          marginTop: `${Math.round(14 * scale)}px`,
          fontSize: `${Math.max(Math.round((node.type === 'Category' ? 11 : 10) * scale), 9)}px`,
          letterSpacing: `${(2 * scale).toFixed(1)}px`,
          fontWeight: isExpanded ? '600' : '400',
          textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
          transition: 'color 250ms ease, font-weight 250ms ease'
        }}
      >
        {node.title}
      </span>
    </div>
  );
});

export default SceneNode;