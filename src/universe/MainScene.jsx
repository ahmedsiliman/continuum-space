import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3-force';
import MagneticField from './MagneticField';
import UniverseTitle from './UniverseTitle';
import { useViewportScale } from '../utils/useViewportScale';

// Base ring radii at scale=1 (design baseline: ~1000px min viewport dimension).
// Actual values are computed inside the component from useViewportScale().

function getDeterministicSeed(value = '') {
  return Array.from(value).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

// Pulls every node type onto its own concentric ring around the origin.
// Strength decreases outward — inner Category ring is tightest; Project ring
// has the most freedom so the spring tether can group them near their parent.
// Accepts a ref so the orbit force always reads the current scaled radius
// without needing to recreate the simulation on resize.
function createOrbitForce(ringRadiusRef) {
  const STRENGTH = { Category: 0.16, SubCategory: 0.13, Project: 0.10 };
  let nodesList = [];
  function force(alpha) {
    for (const node of nodesList) {
      const targetRadius = ringRadiusRef.current[node.type];
      if (!targetRadius) continue;
      const d = Math.hypot(node.x, node.y) || 1;
      const pull = (d - targetRadius) * (STRENGTH[node.type] || 0.10) * alpha;
      node.vx -= (node.x / d) * pull;
      node.vy -= (node.y / d) * pull;
    }
  }
  force.initialize = function (nodes) { nodesList = nodes; };
  return force;
}

export default function MainScene({
  database,
  site,
  onSelectProject,
  onNodeInteract,
  expandedNodes,
  isPaused
}) {
  const containerRef = useRef(null);
  const nodesRef = useRef([]);      
  const nodeElementsRef = useRef({}); 
  const simulationRef = useRef(null);
  const draggingNodeRef = useRef(null);
  const dragMetaRef = useRef({ moved: false, startClientX: 0, startClientY: 0 });
  const offsetRef = useRef({ x: 0, y: 0 }); 
  const dragStateRef = useRef({ isDragging: false, progress: 0 });
  const snapBackRef = useRef(new Map());
  const linkElementsRef = useRef({});
  const linksRef = useRef([]);            // mirrors `links`, read by render loop
  const expandedSetRef = useRef(new Set()); // mirrors `expandedSet`, read by render loop

  const isPausedRef = useRef(false); 
  const hintRef = useRef(null);
  const titleRef = useRef(null);

  // ── Drag-effect element refs ─────────────────────────────────────────
  const nodeDotRef      = useRef({});   // Project node dot → color bleed
  const nodeLabelRef    = useRef({});   // Project node label → text swap
  const progressArcRef  = useRef({});   // Project progress ring SVG arc
  const boundaryPathRef = useRef(null); // deformed boundary ring path
  const boundaryHltRef  = useRef(null); // bright arc highlight on boundary
  // ── Viewport-adaptive scale ──────────────────────────────────────────────────
  const { scale } = useViewportScale();

  // All spatial constants derived from scale so they adapt on resize.
  const ringRadius = {
    Category:    Math.round(155 * scale),
    SubCategory: Math.round(285 * scale),
    Project:     Math.round(400 * scale),
  };
  const boundaryRadius = Math.round(520 * scale);
  const coreRadius     = Math.round(40  * scale);
  const typeOrbitRadius = {
    Root:        Math.round(80 * scale),
    Category:    ringRadius.Category,
    SubCategory: ringRadius.SubCategory,
    Project:     ringRadius.Project,
  };
  const typeNodeRadius = {
    Root:        Math.max(Math.round(34 * scale), 14),
    Category:    Math.max(Math.round(22 * scale),  9),
    SubCategory: Math.max(Math.round(15 * scale),  7),
    Project:     Math.max(Math.round(11 * scale),  6),
  };

  // Refs so closure-based effects ([] deps) always read the current scale
  // without being recreated. Updated synchronously every render.
  const ringRadiusRef     = useRef(ringRadius);
  const boundaryRadiusRef = useRef(boundaryRadius);
  ringRadiusRef.current     = ringRadius;
  boundaryRadiusRef.current = boundaryRadius;
  const expandedSet = useMemo(() => new Set(expandedNodes || []), [expandedNodes]);
  // Keep ref in sync so the render loop (created once, empty deps) always sees current value.
  useEffect(() => { expandedSetRef.current = expandedSet; }, [expandedSet]);

  const expandableIds = useMemo(() => {
    if (!database?.nodes?.length) {
      return new Set();
    }

    const parentIds = database.nodes
      .map((node) => node.parent_id)
      .filter(Boolean);

    return new Set(parentIds);
  }, [database]);

  const nodes = useMemo(() => {
    if (!database?.nodes?.length) {
      return [];
    }

    const nodeById = new Map(database.nodes.map((node) => [node.id, node]));
    const childrenByParent = database.nodes.reduce((map, node) => {
      if (!node.parent_id) {
        return map;
      }

      if (!map[node.parent_id]) {
        map[node.parent_id] = [];
      }

      map[node.parent_id].push(node);
      return map;
    }, {});

    const expanded = new Set(expandedNodes || []);
    const visibleIds = new Set();

    database.nodes
      .filter((node) => node.type === 'Category' && (node.parent_id === 'root' || !node.parent_id))
      .forEach((node) => visibleIds.add(node.id));

    expanded.forEach((parentId) => {
      const children = childrenByParent[parentId] || [];
      children.forEach((child) => visibleIds.add(child.id));
    });

    const projectById = new Map((database.projects || []).map((project) => [project.id, project]));

    const visibleNodeIds = Array.from(visibleIds);
    const depthOrder = { Category: 1, SubCategory: 2, Project: 3, Root: 0 };
    visibleNodeIds.sort((a, b) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      return (depthOrder[nodeA?.type] || 99) - (depthOrder[nodeB?.type] || 99);
    });

    const placedNodes = new Map();

    return visibleNodeIds
      .map((id) => nodeById.get(id))
      .filter(Boolean)
      .map((node) => {
        const seed = getDeterministicSeed(node.id || '0');
        const orbitRadius = typeOrbitRadius[node.type] || typeOrbitRadius.Project;
        const angle = (seed % 360) * (Math.PI / 180);

        const projectData = node.type === 'Project'
          ? (projectById.get(node.id) || {
            id: node.id,
            title: node.title,
            layout: node.layout,
            externalApp: node.externalApp,
            modelData: node.modelData,
            content: []
          })
          : null;

        let initialX = Math.cos(angle) * orbitRadius;
        let initialY = Math.sin(angle) * orbitRadius;

        if (node.parent_id) {
          const parentNode = placedNodes.get(node.parent_id);
          if (parentNode) {
            // Spawn on the node's own ring at the parent's angle ± a small jitter.
            // The orbit force barely needs to move it; repulsion handles angular spacing.
            const parentAngle = Math.atan2(parentNode.y, parentNode.x);
            const jitter = ((seed % 60) - 30) * (Math.PI / 180);
            const ringR = ringRadius[node.type] || orbitRadius;
            initialX = Math.cos(parentAngle + jitter) * ringR;
            initialY = Math.sin(parentAngle + jitter) * ringR;
          }
        }

        const assembledNode = {
          ...node,
          project: projectData,
          x: initialX,
          y: initialY,
          orbitRadius,
          nodeRadius: typeNodeRadius[node.type] || 13
        };

        placedNodes.set(node.id, assembledNode);

        return assembledNode;
      });
  }, [database, expandedNodes, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const links = useMemo(() => {
    const visible = new Set(nodes.map((node) => node.id));

    return nodes
      .filter((node) => !!node.parent_id && visible.has(node.parent_id))
      .map((node) => ({
        id: `${node.parent_id}->${node.id}`,
        parentId: node.parent_id,
        childId: node.id,
        childType: node.type
      }));
  }, [nodes]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Simulation shell + render loop — created ONCE (empty deps), never torn
  // down on expand/collapse. All dynamic data flows through refs.
  useEffect(() => {
    simulationRef.current = d3.forceSimulation([])
      .alphaDecay(0.016)
      .velocityDecay(0.42)
      .force('charge', d3.forceManyBody().strength(-38))
      .force('collide', d3.forceCollide().radius((node) => node.nodeRadius + 9).strength(0.9))
      .force('links', d3.forceLink([])
        .id((n) => n.id)
        .distance((link) => link.childType === 'Project' ? 120 : 135)
        .strength(0.18)
      )
      .force('orbit', createOrbitForce(ringRadiusRef))
      .force('center', d3.forceCenter(0, 0).strength(0.006));

    // --- DOM RENDER LOOP ---
    let animationFrameId;
    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      if (isPausedRef.current) return; 

      const nodeById = new Map(nodesRef.current.map((node) => [node.id, node]));

      // Eased snap-back for structural nodes after drag release.
      snapBackRef.current.forEach((snap, nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) {
          snapBackRef.current.delete(nodeId);
          return;
        }

        const dx = snap.targetX - node.fx;
        const dy = snap.targetY - node.fy;

        snap.vx = (snap.vx + dx * 0.13) * 0.8;
        snap.vy = (snap.vy + dy * 0.13) * 0.8;

        node.fx += snap.vx;
        node.fy += snap.vy;
        node.x = node.fx;
        node.y = node.fy;

        if (Math.hypot(dx, dy) < 0.9 && Math.hypot(snap.vx, snap.vy) < 0.25) {
          node.fx = null;
          node.fy = null;
          snapBackRef.current.delete(nodeId);
        }
      });

      nodesRef.current.forEach(node => {
        // Apply boundary gravity to free nodes
        if (draggingNodeRef.current !== node) {
          const distance = Math.sqrt(node.x ** 2 + node.y ** 2);
          const safeZone = boundaryRadiusRef.current - 100;
          if (distance > safeZone) {
            const pullStrength = (distance - safeZone) * 0.04;
            node.vx -= (node.x / distance) * pullStrength;
            node.vy -= (node.y / distance) * pullStrength;
          }
        }

        // Update CSS positions + drag-stretch / color-bleed effects for Project nodes
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
              dot.style.backgroundColor = `rgb(${Math.round(220 + prog * 35)}, ${Math.round(229 + prog * 26)}, 255)`;
              dot.style.boxShadow = `0 0 ${(6 + prog * 28).toFixed(0)}px rgba(0,229,255,${(0.4 + prog * 0.6).toFixed(2)}), 0 0 ${(prog * 60).toFixed(0)}px rgba(0,229,255,${(prog * 0.4).toFixed(2)})`;
            }

            const arc = progressArcRef.current[node.id];
            if (arc) {
              const circ = 2 * Math.PI * 20;
              arc.setAttribute('stroke-dashoffset', (circ * (1 - prog)).toFixed(2));
              arc.setAttribute('stroke', `rgba(0, 229, 255, ${(0.3 + prog * 0.7).toFixed(2)})`);
            }
          } else {
            el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
            if (node.type === 'Project') {
              const dot = nodeDotRef.current[node.id];
              if (dot) {
                dot.style.backgroundColor = '#ffffff';
                dot.style.boxShadow = expandedSetRef.current.has(node.id)
                  ? '0 0 26px rgba(0, 229, 255, 0.95), 0 0 44px rgba(0, 229, 255, 0.35), inset 0 0 10px rgba(255,255,255,0.9)'
                  : '0 0 30px rgba(255,255,255,1), 0 0 60px #00E5FF, inset 0 0 10px #0088FF';
              }
              const arc = progressArcRef.current[node.id];
              if (arc) {
                arc.setAttribute('stroke-dashoffset', String(2 * Math.PI * 20));
                arc.setAttribute('stroke', 'rgba(0,229,255,0)');
              }
            }
          }
        }
      });

      // ── Boundary ring: deformed dashed circle during Project drag ──────
      const dp = draggingNodeRef.current?.type === 'Project' ? draggingNodeRef.current : null;
      if (boundaryPathRef.current) boundaryPathRef.current.style.display = dp ? '' : 'none';
      if (boundaryHltRef.current)  boundaryHltRef.current.style.display  = dp ? '' : 'none';
      if (dp) {
        const prog   = dragStateRef.current.progress || 0;
        const bx     = window.innerWidth  / 2;
        const by     = window.innerHeight / 2;
        const R      = boundaryRadiusRef.current;
        const nAngle = Math.atan2(dp.y, dp.x);
        const bulgeMag = prog * 90;

        let dStr = '';
        for (let i = 0; i <= 120; i++) {
          const theta = (i / 120) * Math.PI * 2;
          const diff  = ((theta - nAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const r     = R + bulgeMag * Math.exp(-7 * diff * diff);
          dStr += `${i === 0 ? 'M' : 'L'}${(bx + Math.cos(theta) * r).toFixed(1)},${(by + Math.sin(theta) * r).toFixed(1)}`;
        }
        boundaryPathRef.current.setAttribute('d', dStr + 'Z');
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
        boundaryHltRef.current.setAttribute('stroke-opacity', (0.5 + prog * 0.5).toFixed(2));
      }

      linksRef.current.forEach((link) => {
        const parentNode = nodeById.get(link.parentId);
        const childNode = nodeById.get(link.childId);
        const pathEl = linkElementsRef.current[link.id];

        if (!parentNode || !childNode || !pathEl) {
          return;
        }

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
      });
    };

    renderLoop();

    return () => {
      simulationRef.current?.stop();
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // empty deps: simulation and render loop live for component lifetime

  // Whenever visible nodes change (expand/collapse), update the running simulation
  // in-place. Existing nodes keep their current x/y — only new children start fresh.
  useEffect(() => {
    if (!simulationRef.current || nodes.length === 0) return;

    // Copy live physics state onto the new node objects for already-visible nodes.
    // For brand-new children, recompute spawn from the parent's LIVE coordinates —
    // prevById has the real current position, not the initial seed position.
    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodes.forEach((node) => {
      const prev = prevById.get(node.id);
      if (prev) {
        // Existing node — restore live position so it doesn't jump.
        node.x  = prev.x  ?? node.x;
        node.y  = prev.y  ?? node.y;
        node.vx = prev.vx ?? 0;
        node.vy = prev.vy ?? 0;
        if (prev.fx != null) node.fx = prev.fx;
        if (prev.fy != null) node.fy = prev.fy;
      } else if (node.parent_id) {
        // New node — spawn at its ring radius at the parent's current angle + jitter.
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

    // Remove snap-backs for nodes that are no longer visible.
    const liveIds = new Set(nodes.map((n) => n.id));
    for (const id of snapBackRef.current.keys()) {
      if (!liveIds.has(id)) snapBackRef.current.delete(id);
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    const d3Links = links.map((link) => ({
      source: link.parentId,
      target: link.childId,
      childType: link.childType
    }));

    simulationRef.current.nodes(nodes);
    simulationRef.current.force('links').links(d3Links);
    // Gentle reheat — settles new children without jerking existing nodes.
    simulationRef.current.alpha(0.5).restart();
  }, [nodes, links]);

  // --- CUSTOM DRAG LOGIC ---
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!draggingNodeRef.current || !simulationRef.current) return;

      const movedDistance = Math.hypot(
        e.clientX - dragMetaRef.current.startClientX,
        e.clientY - dragMetaRef.current.startClientY
      );
      if (movedDistance > 6) {
        dragMetaRef.current.moved = true;
      }

      const targetX = e.clientX - window.innerWidth / 2 - offsetRef.current.x;
      const targetY = e.clientY - window.innerHeight / 2 - offsetRef.current.y;

      draggingNodeRef.current.fx = targetX;
      draggingNodeRef.current.fy = targetY;
      draggingNodeRef.current.x = targetX;
      draggingNodeRef.current.y = targetY;

      const el = nodeElementsRef.current[draggingNodeRef.current.id];
      if (el) {
        el.style.transform = `translate(${e.clientX - offsetRef.current.x}px, ${e.clientY - offsetRef.current.y}px) translate(-50%, -50%)`;
      }

      const distance = Math.sqrt(targetX ** 2 + targetY ** 2);
      if (draggingNodeRef.current.type === 'Project' && distance > boundaryRadiusRef.current) {
        const triggeredProject = draggingNodeRef.current.project;
        
        simulationRef.current.stop();
        draggingNodeRef.current.fx = null;
        draggingNodeRef.current.fy = null;
        draggingNodeRef.current = null;
        document.body.style.cursor = 'auto';
        dragStateRef.current = { isDragging: false, progress: 0 };
        
        if (triggeredProject) {
          onSelectProject(triggeredProject, e.clientX, e.clientY);
        }
      } else {
        dragStateRef.current.progress = 0.2 + 0.8 * (distance / boundaryRadiusRef.current);
        simulationRef.current.alphaTarget(0.3).restart();
      }
    };

    const handlePointerUp = () => {
      if (draggingNodeRef.current) {
        const releasedNode = draggingNodeRef.current;
        const wasMoved = dragMetaRef.current.moved;

        if (!wasMoved) {
          // Pure click — free immediately; expand/collapse handled below.
          releasedNode.fx = null;
          releasedNode.fy = null;
        } else {
          // Drag release — snap back to this node's ring along its current direction.
          const ringR = ringRadiusRef.current[releasedNode.type];
          if (ringR) {
            const distance = Math.hypot(releasedNode.x, releasedNode.y) || 1;
            const targetX = (releasedNode.x / distance) * ringR;
            const targetY = (releasedNode.y / distance) * ringR;
            releasedNode.fx = releasedNode.x;
            releasedNode.fy = releasedNode.y;
            snapBackRef.current.set(releasedNode.id, { targetX, targetY, vx: 0, vy: 0 });
            if (simulationRef.current) simulationRef.current.alphaTarget(0.1).restart();
          } else {
            releasedNode.fx = null;
            releasedNode.fy = null;
            if (simulationRef.current) simulationRef.current.alphaTarget(0.18).restart();
          }
        }

        draggingNodeRef.current = null;
        document.body.style.cursor = 'auto';
        dragStateRef.current = { isDragging: false, progress: 0 };
        if (simulationRef.current) simulationRef.current.alphaTarget(0); 

        if (releasedNode.type !== 'Project' && !wasMoved) {
          onNodeInteract?.(releasedNode);
        }

        dragMetaRef.current = { moved: false, startClientX: 0, startClientY: 0 };
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onSelectProject, onNodeInteract]);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', backgroundColor: '#02040a', position: 'relative', overflow: 'hidden' }}
    >
      {/* LAYER 1: The Graphic Renderer 
        (Notice how cleanly this sits here now!) 
      */}
      <MagneticField nodesRef={nodesRef} isPaused={isPaused} dragStateRef={dragStateRef} draggingNodeRef={draggingNodeRef} scale={scale} />

      {/* LAYER 2: Affordance Hint & Core */}
      <div 
        ref={hintRef}
        style={{
          position: 'absolute', top: '93%', left: '50%', transform: 'translate(-50%, -50%)',
          color: 'rgba(0, 229, 255, 0.6)', fontSize: '12px', letterSpacing: '5.5px',
          opacity: 1, transition: 'opacity 1s ease-out', pointerEvents: 'none'
        }}
      >
        [ CLICK TO EXPAND | DRAG PROJECTS OUTWARD TO OPEN ]
      </div>

      {/* LAYER 2b: Site name + tagline */}
      <UniverseTitle ref={titleRef} site={site} />

      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: `${coreRadius * 2}px`, height: `${coreRadius * 2}px`,
        transform: 'translate(-50%, -50%)', backgroundColor: '#000', 
        borderRadius: '50%', pointerEvents: 'none',
        boxShadow: '0 0 30px #000 inset, 0 0 20px rgba(0, 229, 255, 0.4)',
      }} />

      {/* LAYER 2d: Deformed boundary ring — visible only while dragging a Project node */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
        <defs>
          <filter id="boundaryGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path ref={boundaryPathRef} d="" fill="none" stroke="rgba(0, 229, 255, 1)" strokeWidth="1" strokeDasharray="5 6" strokeLinecap="round" style={{ display: 'none' }} />
        <path ref={boundaryHltRef} d="" fill="none" stroke="rgba(0, 229, 255, 1)" strokeWidth="2.5" strokeLinecap="round" filter="url(#boundaryGlow)" style={{ display: 'none' }} />
      </svg>

      {/* LAYER 3: The HTML Nodes */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        {links.map((link) => (
          <path
            key={link.id}
            ref={(el) => {
              if (!el) {
                delete linkElementsRef.current[link.id];
                return;
              }

              linkElementsRef.current[link.id] = el;
            }}
            d=""
            fill="none"
            stroke={link.childType === 'Project' ? 'rgba(0, 229, 255, 0.33)' : 'rgba(153, 236, 255, 0.42)'}
            strokeWidth={link.childType === 'Project' ? '1.2' : '1.6'}
            strokeLinecap="round"
            style={{ transition: 'opacity 180ms ease' }}
          />
        ))}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
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
          style={{
            position: 'absolute', top: 0, left: 0, display: 'flex', flexDirection: 'column', 
            alignItems: 'center',
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
            transition: 'filter 180ms ease, opacity 180ms ease'
          }}
          onDragStart={(e) => e.preventDefault()} 
          onPointerDown={(e) => {
            e.stopPropagation();
            if (hintRef.current) hintRef.current.style.opacity = '0';
            if (titleRef.current) titleRef.current.explode?.();
            if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();

            draggingNodeRef.current = node;
            const rect = nodeElementsRef.current[node.id].getBoundingClientRect();
            offsetRef.current = {
              x: e.clientX - (rect.left + rect.width / 2),
              y: e.clientY - (rect.top + rect.height / 2)
            };

            dragMetaRef.current = {
              moved: false,
              startClientX: e.clientX,
              startClientY: e.clientY
            };
            
            node.fx = node.x;
            node.fy = node.y;
            document.body.style.cursor = 'grabbing';
            dragStateRef.current = { isDragging: true, progress: 0.2 }; 
          }}
        >
          <div
            ref={(el) => { if (el) nodeDotRef.current[node.id] = el; else delete nodeDotRef.current[node.id]; }}
            style={{
              position: 'relative',
              width: `${node.nodeRadius * 2}px`,
              height: `${node.nodeRadius * 2}px`,
              backgroundColor:
                node.type === 'Category'
                  ? '#69e2ff'
                  : node.type === 'SubCategory'
                    ? '#b7f5ff'
                    : '#ffffff',
              borderRadius: '50%',
              boxShadow:
                expandedSet.has(node.id)
                  ? '0 0 26px rgba(0, 229, 255, 0.95), 0 0 44px rgba(0, 229, 255, 0.35)'
                  : node.type === 'Project'
                  ? '0 0 30px rgba(255,255,255,1), 0 0 60px #00E5FF'
                  : '0 0 24px rgba(0, 229, 255, 0.55)',
              border: expandedSet.has(node.id)
                ? '1px solid rgba(255,255,255,0.95)'
                : node.type === 'SubCategory'
                  ? '1px solid rgba(255,255,255,0.8)'
                  : 'none',
              transform: expandedSet.has(node.id) ? 'scale(1.04)' : 'scale(1)',
              transition: 'box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease'
            }}
          >
            {node.type === 'Project' && (
              <svg width="60" height="60" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', overflow: 'visible', pointerEvents: 'none' }}>
                <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(0,229,255,0.12)" strokeWidth="1.2" />
                <circle
                  ref={(el) => { if (el) progressArcRef.current[node.id] = el; else delete progressArcRef.current[node.id]; }}
                  cx="30" cy="30" r="20" fill="none" stroke="rgba(0,229,255,0)"
                  strokeWidth="2" strokeDasharray={String(2 * Math.PI * 20)} strokeDashoffset={String(2 * Math.PI * 20)}
                  strokeLinecap="round" transform="rotate(-90 30 30)"
                />
              </svg>
            )}
          </div>
          {expandableIds.has(node.id) && node.type !== 'Project' && (
            <div
              style={{
                marginTop: '6px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '1px solid rgba(160, 238, 255, 0.65)',
                color: '#d6f7ff',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                backgroundColor: 'rgba(0,0,0,0.35)'
              }}
            >
              {expandedSet.has(node.id) ? '−' : '+'}
            </div>
          )}
          <span
            ref={(el) => { if (el) nodeLabelRef.current[node.id] = el; else delete nodeLabelRef.current[node.id]; }}
            style={{
              color: node.type === 'Project' ? 'white' : '#d5f6ff',
              marginTop: '14px',
              fontSize: node.type === 'Category' ? '12px' : '11px',
              letterSpacing: '1.8px',
              textTransform: 'uppercase',
              textShadow: '0 2px 15px rgba(0,0,0,1)',
              whiteSpace: 'nowrap'
            }}
          >
            {node.title}
          </span>
        </div>
      ))}
    </div>
  );
}