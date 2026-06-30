import React from 'react';
import { getNodeColor, getGlowColor, HOVER_SCALE } from './MainSceneUtils';

// ── DEBUG TOGGLES ─────────────────────────────────────────────────────────
const DEBUG_DISABLE_WRAPPER_FILTER = false;
const DEBUG_FORCE_HIGHLIGHTED = false;
// ─────────────────────────────────────────────────────────────────────────

// ── Tutorial pulse keyframes injected once into <head> ───────────────────
// We inject via a singleton so we don't repeat the <style> on every node.
let _tutorialStyleInjected = false;
function ensureTutorialStyles() {
  if (_tutorialStyleInjected) return;
  _tutorialStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tutorial-ring-pulse {
      0%   { r: 0; opacity: 0.9; }
      70%  { opacity: 0.35; }
      100% { r: 1; opacity: 0; }
    }
    @keyframes tutorial-ring-pulse-2 {
      0%   { r: 0; opacity: 0.6; }
      70%  { opacity: 0.2; }
      100% { r: 1; opacity: 0; }
    }
    @keyframes tutorial-label-fade {
      0%, 100% { opacity: 0.35; }
      50%       { opacity: 0.85; }
    }
    @keyframes tutorial-drag-arrow {
      0%   { transform: translateX(0px);   opacity: 0.9; }
      50%  { transform: translateX(6px);   opacity: 1;   }
      100% { transform: translateX(0px);   opacity: 0.9; }
    }
  `;
  document.head.appendChild(style);
}

// Pulse ring sizes per node type — scales with the node's visual radius
const RING_SIZES = {
  Category:    { base: 48, spread: 32 },   // Category is largest node
  SubCategory: { base: 32, spread: 22 },
  Project:     { base: 24, spread: 16 },
};

const SceneNode = React.memo(({
  node,
  isExpanded,
  expandable,
  onPointerDown,
  onNodeFocus,
  onHoverChange,
  nodeElementsRef,
  nodeDotRef,
  nodeLabelRef,
  progressArcRef,
  scale,
  activeFilter = 'All',
  searchQuery = '',
  isTutorialTarget = false,
  tutorialHint = null,
  tutorialStage = null,
}) => {
  // Inject styles once on first render of any tutorial-capable node
  React.useEffect(() => { ensureTutorialStyles(); }, []);

  // Local hover state — drives the hover-scale effect on the glass node
  const [isHovered, setIsHovered] = React.useState(false);

  const isProject = node.type === 'Project';
  const nodeFilters = node.filter ? node.filter.split(',').map(f => f.trim().toLowerCase()) : [];
  const activeFilterLower = activeFilter.toLowerCase();

  const matchesFilter = activeFilter === 'All' || nodeFilters.includes(activeFilterLower);
  const matchesSearch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery.toLowerCase());

  let isHighlighted = matchesFilter && matchesSearch;
  if (DEBUG_FORCE_HIGHLIGHTED) isHighlighted = false;
  const isDimmed = !isHighlighted;

  // Tutorial ring geometry — sized proportionally to the node's visual radius
  const rings = RING_SIZES[node.type] || RING_SIZES.Project;
  const nodeR = node.nodeRadius || 11;
  // SVG canvas large enough to contain the outermost animated ring at full scale
  const svgHalf = nodeR + rings.base + rings.spread + 12;
  const svgSize = svgHalf * 2;
  const cx = svgHalf;
  const cy = svgHalf;

  // For the project stage we also render a small directional arrow hint
  const isProjectTarget = isTutorialTarget && tutorialStage === 'project';

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
        filter: (isDimmed && !DEBUG_DISABLE_WRAPPER_FILTER) ? 'grayscale(1) blur(1px)' : 'none',
        pointerEvents: isDimmed ? 'none' : 'auto',
        zIndex: isHighlighted ? 10 : 1,
      }}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => onPointerDown(e, node)}
      onPointerEnter={() => {
        onNodeFocus?.(node);
        setIsHovered(true);
        onHoverChange?.(node.id);
      }}
      onPointerLeave={() => {
        onNodeFocus?.(null);
        setIsHovered(false);
        onHoverChange?.(null);
      }}
    >

      {/* ── Node dot anchor — relative container so the pulse SVG centers on
             the node dot itself, not the whole flex column (which also
             includes the sub-action indicator, label, and hint) ────────── */}
      <div style={{ position: 'relative', width: `${node.nodeRadius * 2}px`, height: `${node.nodeRadius * 2}px` }}>

        {/* ── Tutorial pulse rings — rendered behind the node dot ─────────── */}
        {isTutorialTarget && !isExpanded && (
          <svg
            width={svgSize}
            height={svgSize}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              overflow: 'visible',
              pointerEvents: 'none',
              // Raise above the node dot so pulses read over the glow
              zIndex: 20,
            }}
          >
            {/* Wave 1 — slower, larger spread */}
            <circle
              cx={cx} cy={cy}
              fill="none"
              stroke={`hsla(${node.hue}, 100%, 72%, 0.75)`}
              strokeWidth="1.2"
              style={{
                animation: 'none',
                transformOrigin: `${cx}px ${cy}px`,
              }}
            >
              <animate
                attributeName="r"
                from={nodeR + 2}
                to={nodeR + rings.base + rings.spread}
                dur="2.2s"
                begin="0s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0.4;0"
                dur="2.2s"
                begin="0s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Wave 2 — offset by half-period for continuous feel */}
            <circle
              cx={cx} cy={cy}
              fill="none"
              stroke={`hsla(${node.hue}, 100%, 72%, 0.55)`}
              strokeWidth="0.8"
            >
              <animate
                attributeName="r"
                from={nodeR + 2}
                to={nodeR + rings.base + rings.spread}
                dur="2.2s"
                begin="1.1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.25;0"
                dur="2.2s"
                begin="1.1s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Static inner accent ring for visual anchor */}
            <circle
              cx={cx} cy={cy}
              r={nodeR + 6}
              fill="none"
              stroke={`hsla(${node.hue}, 100%, 75%, 0.3)`}
              strokeWidth="1"
              strokeDasharray="3 5"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${cx} ${cy}`}
                to={`360 ${cx} ${cy}`}
                dur="8s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        )}

        {/* ── Main Smoked Glass Node ────────────────────────────────────── */}
        <div
          ref={(el) => { if (el) nodeDotRef.current[node.id] = el; else delete nodeDotRef.current[node.id]; }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${node.nodeRadius * 2}px`,
            height: `${node.nodeRadius * 2}px`,

          backgroundColor: isExpanded
            ? `hsla(${node.hue}, 55%, 28%, 0.55)`
            : `hsla(${node.hue}, 38%, 62%, 0.65)`,

          borderRadius: '50%',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',

          boxShadow: isExpanded
            ? `0 0 22px hsla(${node.hue}, 100%, 65%, 0.60), 0 0 48px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 0 22px hsla(${node.hue}, 100%, 60%, 0.22), inset 0 1px 2px rgba(255,255,255,0.18)`
            : isHovered
              ? `inset 0 0 18px hsla(${node.hue}, 100%, 60%, 0.35), inset 0 1px 1px rgba(255,255,255,0.2), 0 0 18px hsla(${node.hue}, 100%, 60%, 0.35)`
              : `inset 0 0 16px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 1px 1px rgba(255,255,255,0.18)`,

          filter: isExpanded
            ? 'none'
            : isHovered
              ? `drop-shadow(0 0 4px hsla(${node.hue}, 100%, 10%, 0.5)) drop-shadow(0 0 14px hsla(${node.hue}, 100%, 55%, 0.55))`
              : `drop-shadow(0 0 3px hsla(${node.hue}, 100%, 10%, 0.5)) drop-shadow(0 0 10px hsla(${node.hue}, 100%, 50%, 0.4))`,

          border: `1.25px solid hsla(${node.hue}, 100%, 72%, 0.98)`,
          outline: isExpanded ? 'none' : `1px solid hsla(${node.hue}, 100%, 60%, 0.55)`,

          transform: isExpanded
            ? 'scale(1.56)'
            : isHovered
              ? `scale(${HOVER_SCALE})`
              : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1), background-color 250ms ease, box-shadow 250ms ease, filter 250ms ease, outline 250ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          // Lift above pulse rings so the node itself stays crisp
          zIndex: 21,
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

      {/* ── Tutorial hint label — appears below the node title ────────────── */}
      {isTutorialTarget && !isExpanded && tutorialHint && (
        <div
          style={{
            marginTop: `${Math.round(8 * scale)}px`,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'none',
          }}
        >
          {/* Bracket + text */}
          <span
            style={{
              fontFamily: "'Share Tech Mono', 'Consolas', monospace",
              fontSize: `${Math.max(Math.round(8.5 * scale), 7)}px`,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: `hsla(${node.hue}, 100%, 75%, 0.7)`,
              textShadow: `0 0 12px hsla(${node.hue}, 100%, 65%, 0.5)`,
              whiteSpace: 'nowrap',
              animation: 'tutorial-label-fade 2.4s ease-in-out infinite',
            }}
          >
            [ {tutorialHint} {isProjectTarget ? '' : ''} ]
          </span>

          {/* Arrow for the drag-outward hint */}
          {isProjectTarget && (
            <span
              style={{
                fontFamily: "'Share Tech Mono', 'Consolas', monospace",
                fontSize: `${Math.max(Math.round(9 * scale), 7)}px`,
                color: `hsla(${node.hue}, 100%, 75%, 0.8)`,
                textShadow: `0 0 10px hsla(${node.hue}, 100%, 65%, 0.5)`,
                display: 'inline-block',
                animation: 'tutorial-drag-arrow 1.4s ease-in-out infinite',
                marginLeft: '-2px',
              }}
            >
              →
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default SceneNode;