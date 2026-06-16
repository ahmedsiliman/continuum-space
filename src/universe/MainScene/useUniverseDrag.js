import { useEffect, useRef } from 'react';

export function useUniverseDrag({
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
  titleRef,
  isRadialMode,
  radialLayoutMap
}) {
  const dragMetaRef = useRef({ moved: false, startClientX: 0, startClientY: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  
  // Track radial mode in a ref for the effect
  const isRadialModeRef = useRef(isRadialMode);
  useEffect(() => { isRadialModeRef.current = isRadialMode; }, [isRadialMode]);

  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    if (hintRef.current) hintRef.current.style.opacity = '0';
    if (titleRef.current) titleRef.current.explode?.();
    if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();

    // Trigger focus when node is grabbed
    onNodeFocus?.(node);

    draggingNodeRef.current = node;
    const el = nodeElementsRef.current[node.id];
    if (!el) return;
    const rect = el.getBoundingClientRect();
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
  };

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
          releasedNode.fx = null;
          releasedNode.fy = null;
        } else {
          // If in radial mode, target the specific assigned spot
          const radialTarget = (isRadialModeRef.current && radialLayoutMap) ? radialLayoutMap.get(releasedNode.id) : null;
          
          if (radialTarget) {
             releasedNode.fx = releasedNode.x;
             releasedNode.fy = releasedNode.y;
             snapBackRef.current.set(releasedNode.id, { 
               targetX: radialTarget.x, 
               targetY: radialTarget.y, 
               vx: 0, 
               vy: 0 
             });
             if (simulationRef.current) simulationRef.current.alphaTarget(0.1).restart();
          } else {
            // Dynamic mode or fallback
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
  }, [onSelectProject, onNodeInteract, boundaryRadiusRef, ringRadiusRef, simulationRef, draggingNodeRef, dragStateRef, snapBackRef, nodeElementsRef, radialLayoutMap]);

  return { onNodePointerDown };
}
