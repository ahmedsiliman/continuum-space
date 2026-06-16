
/**
 * Calculates radial coordinates for nodes based on their hierarchy.
 * Distributes angular space proportionally based on the number of children.
 * @param {Array} nodes - The list of nodes currently visible in the scene.
 * @param {Object} ringRadius - The radii for each node type (Category, SubCategory, Project).
 * @returns {Map} A map of node ID to {x, y} coordinates.
 */
export function calculateRadialLayout(nodes, ringRadius) {
  const layout = new Map();
  if (!nodes || nodes.length === 0) return layout;

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  
  // Build children map for current visible nodes
  const childrenByParent = new Map();
  nodes.forEach(node => {
    if (node.parent_id && nodeById.has(node.parent_id)) {
      if (!childrenByParent.has(node.parent_id)) {
        childrenByParent.set(node.parent_id, []);
      }
      childrenByParent.get(node.parent_id).push(node);
    }
  });

  // Root nodes are those whose parent is 'root' or not in our visible set
  const rootNodes = nodes.filter(n => n.parent_id === 'root' || !n.parent_id || !nodeById.has(n.parent_id));
  
  // Pre-calculate weights (number of descendants) for each node to distribute space fairly
  const weights = new Map();
  const calculateWeight = (nodeId) => {
    const children = childrenByParent.get(nodeId) || [];
    if (children.length === 0) {
      weights.set(nodeId, 1);
      return 1;
    }
    const w = children.reduce((sum, child) => sum + calculateWeight(child.id), 0);
    weights.set(nodeId, w);
    return w;
  };
  
  rootNodes.forEach(node => calculateWeight(node.id));
  const totalWeight = rootNodes.reduce((sum, node) => sum + weights.get(node.id), 0);

  const assignPositions = (nodeList, startAngle, endAngle) => {
    if (!nodeList || nodeList.length === 0) return;

    const sortedNodes = [...nodeList].sort((a, b) => a.id.localeCompare(b.id));
    const totalArc = endAngle - startAngle;
    
    let currentAngle = startAngle;
    const listWeight = sortedNodes.reduce((sum, node) => sum + weights.get(node.id), 0);

    sortedNodes.forEach((node) => {
      const nodeWeight = weights.get(node.id);
      const nodeArc = (nodeWeight / listWeight) * totalArc;
      
      // Place node in the center of its weighted arc
      const angle = currentAngle + nodeArc / 2;
      const radius = ringRadius[node.type] || 0;
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      layout.set(node.id, { x, y });
      
      const children = childrenByParent.get(node.id);
      if (children) {
        // Recurse with the proportional arc allocated to this node
        assignPositions(children, currentAngle, currentAngle + nodeArc);
      }
      
      currentAngle += nodeArc;
    });
  };

  // Assign positions starting from root nodes across a full circle
  assignPositions(rootNodes, 0, Math.PI * 2);

  return layout;
}
