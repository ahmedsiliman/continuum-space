import { useEffect, useMemo, useRef, useState } from 'react';
import spaceBg from '../../assets/space.jpg';
import MagneticField from '../MagneticField';
import UniverseTitle from '../UniverseTitle';
import { useViewportScale } from '../../utils/useViewportScale';
import './MainScene.css';

// Sub-modules
import { getDeterministicSeed, getCategoryHue } from './MainSceneUtils';
import SceneNode from './SceneNode';
import SceneLink from './SceneLink';
import { useSimulation } from './useSimulation';
import { useUniverseDrag } from './useUniverseDrag';
import { calculateRadialLayout } from './RadialLayout';

export default function MainScene({
  database,
  site,
  onSelectProject,
  onNodeInteract,
  onNodeFocus,
  expandedNodes,
  isPaused,
  activeFilter,
  searchQuery,
  isRadialMode,
  setIsRadialMode
}) {
  const { scale } = useViewportScale();

  // 1. Spatial Geometry - ORIGINALS
  const ringRadius = useMemo(() => ({
    Category:    Math.round(100 * scale),
    SubCategory: Math.round(250 * scale),
    Project:     Math.round(400 * scale),
  }), [scale]);

  const boundaryRadius = useMemo(() => Math.round(520 * scale), [scale]);
  const coreRadius     = useMemo(() => Math.round(100  * scale), [scale]);
  
  const typeOrbitRadius = useMemo(() => ({
    Root:        Math.round(50 * scale),
    Category:    ringRadius.Category,
    SubCategory: ringRadius.SubCategory,
    Project:     ringRadius.Project,
  }), [scale, ringRadius]);

  const typeNodeRadius = useMemo(() => ({
    Root:        Math.max(Math.round(34 * scale), 14),
    Category:    Math.max(Math.round(22 * scale),  9),
    SubCategory: Math.max(Math.round(15 * scale),  7),
    Project:     Math.max(Math.round(11 * scale),  6),
  }), [scale]);

  const ringRadiusRef     = useRef(ringRadius);
  const boundaryRadiusRef = useRef(boundaryRadius);
  ringRadiusRef.current     = ringRadius;
  boundaryRadiusRef.current = boundaryRadius;

  const simulationRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const draggingNodeRef = useRef(null);
  const dragStateRef = useRef({ isDragging: false, progress: 0 });
  const snapBackRef = useRef(new Map());

  const nodeElementsRef = useRef({});
  const nodeDotRef      = useRef({});
  const nodeLabelRef    = useRef({});
  const progressArcRef  = useRef({});
  const linkElementsRef = useRef({});
  const boundaryPathRef = useRef(null);
  const boundaryHltRef  = useRef(null);
  const hintRef = useRef(null);
  const titleRef = useRef(null);

  const expandedSet = useMemo(() => new Set(expandedNodes || []), [expandedNodes]);
  const expandedSetRef = useRef(expandedSet);
  useEffect(() => { expandedSetRef.current = expandedSet; }, [expandedSet]);

  const expandableIds = useMemo(() => {
    if (!database?.nodes?.length) return new Set();
    const parentIds = database.nodes.map((node) => node.parent_id).filter(Boolean);
    return new Set(parentIds);
  }, [database]);

  // 4. Node Calculation - RESTORED ORIGINAL JITTER LOGIC
  const nodes = useMemo(() => {
    if (!database?.nodes?.length) return [];
    
    const nodeById = new Map(database.nodes.map((node) => [node.id, node]));
    const childrenByParent = database.nodes.reduce((map, node) => {
      if (!node.parent_id) return map;
      if (!map[node.parent_id]) map[node.parent_id] = [];
      map[node.parent_id].push(node);
      return map;
    }, {});

    const visibleIds = new Set();
    database.nodes
      .filter((node) => node.type === 'Category' && (node.parent_id === 'root' || !node.parent_id))
      .forEach((node) => visibleIds.add(node.id));

    expandedSet.forEach((parentId) => {
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
    return visibleNodeIds.map((id) => nodeById.get(id)).filter(Boolean).map((node) => {
      const seed = getDeterministicSeed(node.id || '0');
      const orbitRadius = typeOrbitRadius[node.type] || typeOrbitRadius.Project;
      const angle = (seed % 360) * (Math.PI / 180);
      const hue = getCategoryHue(node.id, node.parent_id, nodeById);
      const projectData = node.type === 'Project' ? (projectById.get(node.id) || { id: node.id, title: node.title, content: [] }) : null;
      
      let initialX = Math.cos(angle) * orbitRadius;
      let initialY = Math.sin(angle) * orbitRadius;
      
      if (node.parent_id) {
        const parentNode = placedNodes.get(node.parent_id);
        if (parentNode) {
          const parentAngle = Math.atan2(parentNode.y, parentNode.x);
          const jitter = ((seed % 60) - 30) * (Math.PI / 180);
          const ringR = ringRadius[node.type] || orbitRadius;
          initialX = Math.cos(parentAngle + jitter) * ringR;
          initialY = Math.sin(parentAngle + jitter) * ringR;
        }
      }
      
      const assembledNode = { 
        ...node, 
        hue, 
        project: projectData, 
        x: initialX, 
        y: initialY, 
        orbitRadius, 
        nodeRadius: typeNodeRadius[node.type] || 13 
      };
      
      placedNodes.set(node.id, assembledNode);
      return assembledNode;
    });
  }, [database, expandedSet, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const links = useMemo(() => {
    const visible = new Set(nodes.map((node) => node.id));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return nodes.filter((node) => !!node.parent_id && visible.has(node.parent_id)).map((node) => {
      const parent = nodeById.get(node.parent_id);
      return { id: `${node.parent_id}->${node.id}`, parentId: node.parent_id, childId: node.id, childType: node.type, parentHue: parent?.hue ?? 192 };
    });
  }, [nodes]);

  // Radial Layout Calculation
  const radialLayoutMap = useMemo(() => {
    return calculateRadialLayout(nodes, ringRadius);
  }, [nodes, ringRadius]);

  // Hook 1: Interaction & Drag Logic
  const { onNodePointerDown } = useUniverseDrag({
    simulationRef,
    draggingNodeRef,
    dragStateRef,
    snapBackRef,
    onSelectProject,
    onNodeInteract,
    onNodeFocus,
    ringRadiusRef,
    boundaryRadiusRef,
    nodeElementsRef,
    hintRef,
    titleRef
  });

  // Hook 2: Physics Simulation & Render Loop
  useSimulation({
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
    scale
  });
// Background Color
return (
  <div style={{ 
    width: '100vw', 
    height: '100vh', 
    backgroundColor: '#02040a', 
    backgroundImage: `url(${spaceBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative', 
    overflow: 'hidden' 
    
  }}>
    
    <div style={{
      opacity: isPaused ? 0.15 : 1,
      transition: 'opacity 0.8s ease',
      pointerEvents: isPaused ? 'none' : 'auto',
      width: '100%',
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0
    }}>
      <MagneticField nodesRef={nodesRef} isPaused={isPaused} dragStateRef={dragStateRef} draggingNodeRef={draggingNodeRef} scale={scale} />

      <div ref={hintRef} style={{ position: 'absolute', top: '95%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(222, 222, 222, 0.6)', fontSize: `${11 * scale}px`, letterSpacing: '5.5px', textAlign: 'center', opacity: 1, transition: 'opacity 1s ease-out', pointerEvents: 'none' }}>
        [ CLICK TO EXPAND / DRAG PROJECTS OUTWARD TO OPEN ]
      </div>

      <div ref={hintRef} style={{ position: 'absolute', top: '92%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(222, 222, 222, 0.6)', fontSize: `${11 * scale}px`, letterSpacing: '5.5px', textAlign: 'center', opacity: 1, transition: 'opacity 1s ease-out', pointerEvents: 'none' }}>
        [EVERYTHING IS CONNECTED AT A DISTANCE]
      </div>

      <UniverseTitle ref={titleRef} site={site} />
        {/* // Central Core Circle */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: `${coreRadius * 2}px`, height: `${coreRadius * 2}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#00000000', borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 0 30px #202020 inset, 0 0 40px #818181 ' }} />

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

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {links.map((link) => (
          <SceneLink key={link.id} link={link} linkElementsRef={linkElementsRef} />
        ))}
      </svg>

      {nodes.map((node) => (
        <SceneNode
          key={node.id}
          node={node}
          isExpanded={expandedSet.has(node.id)}
          expandable={expandableIds.has(node.id)}
          onPointerDown={onNodePointerDown}
          onNodeFocus={onNodeFocus}
          nodeElementsRef={nodeElementsRef}
          nodeDotRef={nodeDotRef}
          nodeLabelRef={nodeLabelRef}
          progressArcRef={progressArcRef}
          scale={scale}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  </div>
);
}
