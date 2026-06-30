// Hover scale-up factor applied to a node's visual dot (SceneNode.jsx) and
// mirrored in the simulation's collision radius (useSimulation.js) so
// neighboring nodes physically make room instead of being overlapped.
export const HOVER_SCALE = 1.5;

export const CATEGORY_HUES = {
  cat_bim: 192, // Cyan-blue
  cat_acd: 280, // Purple
  cat_art: 32,  // Orange-gold
  cat_cmp: 155, // Emerald green
};

export function getDeterministicSeed(value = '') {
  return Array.from(String(value)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

export function getCategoryHue(nodeId, parentId, nodeById) {
  if (CATEGORY_HUES[nodeId] !== undefined) return CATEGORY_HUES[nodeId];
  
  let currentId = parentId;
  let safety = 0;
  while (currentId && currentId !== 'root' && safety < 10) {
    if (CATEGORY_HUES[currentId] !== undefined) return CATEGORY_HUES[currentId];
    const parentNode = nodeById.get(currentId);
    currentId = parentNode?.parent_id;
    safety++;
  }

  const seed = getDeterministicSeed(nodeId || 'default');
  return seed % 360;
}

export function getNodeColor(hue, type, opacity = 1) {
  if (type === 'Category') return `hsla(${hue}, 85%, 70%, ${opacity})`;
  if (type === 'SubCategory') return `hsla(${hue}, 65%, 85%, ${opacity})`;
  return `hsla(${hue}, 30%, 98%, ${opacity})`;
}

export function getGlowColor(hue, intensity = 1, opacity = 0.6) {
  return `hsla(${hue}, 100%, 50%, ${opacity * intensity})`;
}

export function createOrbitForce(ringRadiusRef) {
  const STRENGTH = { Category: 1.16, SubCategory: 0.13, Project: 0.50 };
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