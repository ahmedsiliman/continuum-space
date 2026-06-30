import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { createOrbitForce, getNodeColor, getDeterministicSeed, HOVER_SCALE } from './MainSceneUtils';

export function useSimulation({
  nodes,
  links,
  isPaused,
  simulationRef,
  nodesRef,
  linksRef,
  ringRadiusRef,
  boundaryRadiusRef,
  expandedSetRef,
  draggingNodeRef,
  dragStateRef,
  snapBackRef,
  nodeElementsRef,
  nodeDotRef,
  progressArcRef,
  linkElementsRef,
  boundaryPathRef,
  boundaryHltRef,
  isRadialMode,
  radialLayoutMap,
  scale = 1 // 1. Accept the live viewport scale prop
}) {
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const isRadialModeRef = useRef(isRadialMode);
  useEffect(() => { isRadialModeRef.current = isRadialMode; }, [isRadialMode]);

  // 2. Maintain a ref for scale so the single-instanced animation loop avoids stale closures
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Tracks the currently hovered node id so the collision force can inflate
  // its radius on demand. A ref (not state) because d3-force's tick loop
  // reads it every frame and we don't want this to trigger React re-renders.
  const hoveredNodeIdRef = useRef(null);
  // d3-force's forceCollide() precomputes per-node radii inside .radius(fn)
  // — it does NOT re-call the accessor every tick. We keep a handle to the
  // exact accessor in use so onNodeHoverChange can re-invoke .radius(fn) to
  // force a recompute the moment hover state changes.
  const collideRadiusFnRef = useRef(null);

  // 1. Initialize simulation once with ORIGINAL force values
  useEffect(() => {
    if (simulationRef.current) return;

    const initialCollideRadius = (node) => {
      const base = (node.nodeRadius || 20) * scaleRef.current;
      const inflated = hoveredNodeIdRef.current === node.id ? base * HOVER_SCALE : base;
      return inflated + 20 * scaleRef.current;
    };
    collideRadiusFnRef.current = initialCollideRadius;

    simulationRef.current = d3.forceSimulation([])
      .alphaDecay(0.012)
      .velocityDecay(0.4)
      .force('charge', d3.forceManyBody().strength(-200))
      .force('collide', d3.forceCollide().radius(initialCollideRadius).strength(0.9))
      .force('links', d3.forceLink([])
        .id((n) => n.id)
        .distance((link) => link.childType === 'Project' ? 90 : 110)
        .strength(.18)
      )
      .force('orbit', createOrbitForce(ringRadiusRef))
      // .force('center', d3.forceCenter(0, 0).strength(0.07))
      // ADD: Gentle gravity that doesn't calculate center-of-mass shifting
      .force('gravityX', d3.forceX(0).strength(0.015))
      .force('gravityY', d3.forceY(0).strength(0.015))

      .force('radialX', d3.forceX().x(d => d.radialX || 0).strength(0))
      .force('radialY', d3.forceY().y(d => d.radialY || 0).strength(0));

    let animationFrameId;
    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      if (isPausedRef.current) return;

      const currentNodes = nodesRef.current || [];
      const nodeById = new Map(currentNodes.map((node) => [node.id, node]));

      // Eased snap-back logic
      snapBackRef.current.forEach((snap, nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) {
          snapBackRef.current.delete(nodeId);
          return;
        }
        
        if (draggingNodeRef.current === node) return;

        const dx = snap.targetX - (node.fx ?? node.x);
        const dy = snap.targetY - (node.fy ?? node.y);
        
        if (node.fx == null) node.fx = node.x;
        if (node.fy == null) node.fy = node.y;

        snap.vx = (snap.vx + dx * 0.08) * 0.85;
        snap.vy = (snap.vy + dy * 0.08) * 0.85;
        node.fx += snap.vx;
        node.fy += snap.vy;
        node.x = node.fx;
        node.y = node.fy;

        if (Math.hypot(dx, dy) < 0.5 && Math.hypot(snap.vx, snap.vy) < 0.15) {
          node.fx = null;
          node.fy = null;
          snapBackRef.current.delete(nodeId);
        }
      });

      // Update positions and boundary
      currentNodes.forEach(node => {
        if (!node) return;
        if (draggingNodeRef.current !== node) {
          const distance = Math.sqrt(node.x ** 2 + node.y ** 2);
          
          // 3. Make the boundary safe-zone padding proportional to the scale factor
          const safeZone = (boundaryRadiusRef.current || 520) - (100 * scaleRef.current);
          if (distance > safeZone) {
            const pullStrength = (distance - safeZone) * 0.04;
            node.vx -= (node.x / distance) * pullStrength;
            node.vy -= (node.y / distance) * pullStrength;
          }
        }
        
        // ADD THIS SPEED LIMIT: Clamp velocity to max 12px per frame
        const MAX_SPEED = 12;
        node.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, node.vx));
        node.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, node.vy));
        
        const el = nodeElementsRef.current[node.id];
        if (el) {
          const screenX = window.innerWidth / 2 + node.x;
          const screenY = window.innerHeight / 2 + node.y;
          const isDraggedProject = draggingNodeRef.current === node && node.type === 'Project';
          const prog = isDraggedProject ? (dragStateRef.current.progress || 0) : 0;

          if (isDraggedProject && prog > 0) {
            el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
            const dot = nodeDotRef.current[node.id];
            if (dot) {
              dot.style.backgroundColor = `hsla(${node.hue}, ${(12 + prog * 30).toFixed(0)}%, ${(7 + prog * 18).toFixed(0)}%, ${(0.60 + prog * 0.25).toFixed(2)})`;
              dot.style.boxShadow = `0 0 ${(10 + prog * 36).toFixed(0)}px hsla(${node.hue}, 100%, 65%, ${(0.45 + prog * 0.5).toFixed(2)}), 0 0 ${(prog * 70).toFixed(0)}px hsla(${node.hue}, 100%, 50%, ${(prog * 0.3).toFixed(2)}), inset 0 0 ${(10 + prog * 20).toFixed(0)}px hsla(${node.hue}, 100%, 55%, ${(0.06 + prog * 0.2).toFixed(2)})`;
              dot.style.border = `1.5px solid hsla(${node.hue}, 100%, 65%, ${(0.7 + prog * 0.3).toFixed(2)})`;
            }
            const arc = progressArcRef.current[node.id];
            if (arc) {
              const circ = 2 * Math.PI * 20;
              arc.setAttribute('stroke-dashoffset', (circ * (1 - prog)).toFixed(2));
              arc.setAttribute('stroke', `hsla(${node.hue}, 100%, 50%, ${(0.3 + prog * 0.7).toFixed(2)})`);
            }
          } else {
            el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
            const dot = nodeDotRef.current[node.id];
            if (dot) {
              const isExpanded = expandedSetRef.current ? expandedSetRef.current.has(node.id) : false;
              dot.style.backgroundColor = isExpanded
                ? `hsla(${node.hue}, 55%, 28%, 0.55)`
                : `hsla(${node.hue}, 12%, 7%, 0.60)`;
              dot.style.border = `${isExpanded ? '1.5px' : '1px'} solid hsla(${node.hue}, 100%, 70%, ${isExpanded ? 0.95 : 0.45})`;
              dot.style.boxShadow = isExpanded
                ? `0 0 22px hsla(${node.hue}, 100%, 65%, 0.60), 0 0 48px hsla(${node.hue}, 100%, 55%, 0.25), inset 0 0 22px hsla(${node.hue}, 100%, 60%, 0.22), inset 0 1px 2px rgba(255,255,255,0.18)`
                : `0 0 10px hsla(${node.hue}, 100%, 65%, 0.22), 0 0 22px hsla(${node.hue}, 100%, 65%, 0.08), inset 0 0 10px hsla(${node.hue}, 100%, 55%, 0.06), inset 0 1px 1px rgba(255,255,255,0.06)`;
            }
            if (node.type === 'Project') {
              const arc = progressArcRef.current[node.id];
              if (arc) {
                arc.setAttribute('stroke-dashoffset', String(2 * Math.PI * 20));
                arc.setAttribute('stroke', 'rgba(0,0,0,0)');
              }
            }
          }
        }
      });

      // Boundary deformation rendering
      const dp = draggingNodeRef.current?.type === 'Project' ? draggingNodeRef.current : null;
      if (boundaryPathRef.current) boundaryPathRef.current.style.display = dp ? '' : 'none';
      if (boundaryHltRef.current)  boundaryHltRef.current.style.display  = dp ? '' : 'none';
      if (dp) {
        const prog   = dragStateRef.current.progress || 0;
        const bx     = window.innerWidth  / 2;
        const by     = window.innerHeight / 2;
        const R      = boundaryRadiusRef.current || 520;
        const nAngle = Math.atan2(dp.y, dp.x);
        const bulgeMag = prog * 90;
        const hue = dp.hue || 192;
        let dStr = '';
        for (let i = 0; i <= 120; i++) {
          const theta = (i / 120) * Math.PI * 2;
          const diff  = ((theta - nAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const r     = R + bulgeMag * Math.exp(-7 * diff * diff);
          dStr += `${i === 0 ? 'M' : 'L'}${(bx + Math.cos(theta) * r).toFixed(1)},${(by + Math.sin(theta) * r).toFixed(1)}`;
        }
        boundaryPathRef.current.setAttribute('d', dStr + 'Z');
        boundaryPathRef.current.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 1)`);
        boundaryPathRef.current.setAttribute('stroke-opacity', (0.12 + prog * 0.2).toFixed(2));
        const span = 0.25 + prog * 0.45;
        let hStr = '';
        for (let i = 0; i <= 40; i++) {
          const theta = nAngle - span / 2 + (i / 40) * span;
          const diff  = theta - nAngle;
          const r     = R + bulgeMag * Math.exp(-7 * diff * diff) + 3;
          hStr += `${i === 0 ? 'M' : 'L'}${(bx + Math.cos(theta) * r).toFixed(1)},${(by + Math.sin(theta) * r).toFixed(1)}`;
        }
        boundaryHltRef.current.setAttribute('d', hStr);
        boundaryHltRef.current.setAttribute('stroke', `hsla(${hue}, 100%, 50%, 1)`);
        boundaryHltRef.current.setAttribute('stroke-opacity', (0.5 + prog * 0.5).toFixed(2));
      }

      // Link rendering
      linksRef.current.forEach((link) => {
        const parentNode = nodeById.get(link.parentId);
        const childNode = nodeById.get(link.childId);
        const pathEl = linkElementsRef.current[link.id];
        if (!parentNode || !childNode || !pathEl) return;
        const x1 = window.innerWidth / 2 + parentNode.x;
        const y1 = window.innerHeight / 2 + parentNode.y;
        const x2 = window.innerWidth / 2 + childNode.x;
        const y2 = window.innerHeight / 2 + childNode.y;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const bend = Math.min(55, len * 0.22);
        const cx = (x1 + x2) / 2 + nx * bend;
        const cy = (y1 + y2) / 2 + ny * bend;
        pathEl.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        pathEl.setAttribute('stroke', `hsla(${link.parentHue}, ${link.childType === 'Project' ? '60%' : '80%'}, ${link.childType === 'Project' ? '70%' : '80%'}, ${link.childType === 'Project' ? '0.33' : '0.42'})`);
      });
    };

    renderLoop();
    return () => {
      simulationRef.current?.stop();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. Update simulation data when nodes/links/scale change
  useEffect(() => {
    if (!simulationRef.current) return;
    
    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodes.forEach((node) => {
      const prev = prevById.get(node.id);
      if (prev) {
        node.x  = prev.x  ?? node.x;
        node.y  = prev.y  ?? node.y;
        node.vx = prev.vx ?? 0;
        node.vy = prev.vy ?? 0;
        if (prev.fx != null) node.fx = prev.fx;
        if (prev.fy != null) node.fy = prev.fy;
      } else if (node.parent_id) {
        const liveParent = prevById.get(node.parent_id);
        if (liveParent && liveParent.x != null) {
          const parentAngle = Math.atan2(liveParent.y, liveParent.x);
          const seed = getDeterministicSeed(node.id || '0');
          const jitter = ((seed % 60) - 30) * (Math.PI / 180);
          const ringR = ringRadiusRef.current[node.type] || ringRadiusRef.current.Category;
          node.x = Math.cos(parentAngle + jitter) * ringR;
          node.y = Math.sin(parentAngle + jitter) * ringR;
        }
      }
    });

    nodesRef.current = nodes;
    linksRef.current = links;

    const d3Links = links.map((link) => ({
      source: link.parentId,
      target: link.childId,
      childType: link.childType
    }));

    // 4. Adapt simulation physics parameters dynamically based on radial mode and scale factor
    simulationRef.current.force('charge')
      // If radial mode is on, kill repulsion entirely. If off, apply scaled repulsion.
      .strength(isRadialMode ? 0 : -200 * scale);

    simulationRef.current.force('links')
      .distance((link) => {
        const baseDist = link.childType === 'Project' ? 90 : 110;
        return baseDist * scale; // Shrink links proportionally on mobile
      });

    const collideRadius = (node) => {
      const base = (node.nodeRadius || 20) * scale;
      const inflated = hoveredNodeIdRef.current === node.id ? base * HOVER_SCALE : base;
      return inflated + 20 * scale; // Scale structural bounding boxes down
    };
    collideRadiusFnRef.current = collideRadius;
    simulationRef.current.force('collide').radius(collideRadius);

    // Slightly damp standard charge on smaller viewports to give rings more radial dominance
    simulationRef.current.force('charge')
      .strength(isRadialMode ? -120 : -200);

    simulationRef.current.nodes(nodes);
    simulationRef.current.force('links').links(d3Links);

    // Update Radial Force targets and strengths
    nodes.forEach(node => {
      if (isRadialMode && radialLayoutMap) {
        const target = radialLayoutMap.get(node.id);
        if (target) {
          node.radialX = target.x;
          node.radialY = target.y;
        }
      } else {
        node.radialX = null;
        node.radialY = null;
      }
    });

    simulationRef.current.force('radialX').strength(isRadialMode ? 0.7 : 0);
    simulationRef.current.force('radialY').strength(isRadialMode ? 0.7 : 0);

    const liveIds = new Set(nodes.map((n) => n.id));
    for (const id of snapBackRef.current.keys()) {
      if (!liveIds.has(id)) snapBackRef.current.delete(id);
    }

    const prevIsRadialMode = simulationRef.current.__isRadialMode || false;
    if (isRadialMode && !prevIsRadialMode && radialLayoutMap) {
      nodes.forEach(node => {
        const target = radialLayoutMap.get(node.id);
        if (target) {
          snapBackRef.current.set(node.id, {
            targetX: target.x,
            targetY: target.y,
            vx: 0,
            vy: 0
          });
        }
      });
    }
    simulationRef.current.__isRadialMode = isRadialMode;
    
    simulationRef.current.alpha(0.5).restart();
    
    // 5. Appended scale parameter to the dependencies so layout dynamically recalibrates on viewport changes
  }, [nodes, links, simulationRef, nodesRef, ringRadiusRef, snapBackRef, isRadialMode, radialLayoutMap, scale]);

  // 3. Hover → collision bridge. d3-force caches collision radii on
  // .radius(fn) (see collideRadiusFnRef comment above), so a hover toggle
  // needs to explicitly re-set the accessor to force a recompute — simply
  // mutating hoveredNodeIdRef.current is not enough on its own. We also
  // nudge alphaTarget so the now-larger node visibly pushes its neighbors
  // out instead of just snapping the radius with no motion.
  const onNodeHoverChange = useCallback((nodeId) => {
    hoveredNodeIdRef.current = nodeId;
    if (!simulationRef.current || !collideRadiusFnRef.current) return;
    simulationRef.current.force('collide').radius(collideRadiusFnRef.current);
    simulationRef.current.alphaTarget(nodeId ? 0.15 : 0).restart();
  }, [simulationRef]);

  return { onNodeHoverChange };
}