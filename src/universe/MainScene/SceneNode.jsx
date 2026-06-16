import React from 'react';
import { getNodeColor, getGlowColor } from './MainSceneUtils';
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

  const isHighlighted = matchesFilter && matchesSearch;
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
        filter: isDimmed ? 'grayscale(1) blur(1px)' : 'none',
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

          // Smoked glass: resting = near-black with faint hue tint.
          // Expanded = vivid hue at low-mid opacity so colour blooms through the glass.
          backgroundColor: isExpanded
            ? `hsla(${node.hue}, 55%, 28%, 0.55)`
            : `hsla(${node.hue}, 12%, 70%, 0.60)`,

          borderRadius: '50%',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',

          // Expanded: stronger outer glow + rich inset colour wash through the glass
          boxShadow: isExpanded
            ? `0 0 22px hsla(${node.hue}, 100%, 65%, 0.60), 0 0 48px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 0 22px hsla(${node.hue}, 100%, 60%, 0.22), inset 0 1px 2px rgba(255,255,255,0.18)`
            : `0 0 16px hsla(${node.hue}, 100%, 65%, 0.45), 0 0 32px hsla(${node.hue}, 100%, 65%, 0.22), inset 0 0 12px hsla(${node.hue}, 100%, 55%, 0.15), inset 0 1px 1px rgba(255,255,255,0.18)`,

          // Border brightens and thickens when expanded
          border: `${isExpanded ? '1.5px' : '1px'} solid hsla(${node.hue}, 100%, 70%, ${isExpanded ? 0.95 : 0.80})`,

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