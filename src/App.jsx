import { useEffect, useState } from 'react';
import MainScene from './universe/MainScene';
import IfcLayover from './universe/IfcLayover';
import ModuleTransition from './components/ModuleTransition';
import TelemetryHUD from './components/TelemetryHUD';
import { fetchDatabase } from './utils/DataLoader';

function buildChildrenMap(nodes = []) {
  return nodes.reduce((map, node) => {
    const parentId = node.parent_id;
    if (!parentId) {
      return map;
    }

    if (!map[parentId]) {
      map[parentId] = [];
    }

    map[parentId].push(node.id);
    return map;
  }, {});
}

function collectDescendants(rootId, childrenMap) {
  const descendants = [];
  const stack = [...(childrenMap[rootId] || [])];

  while (stack.length > 0) {
    const currentId = stack.pop();
    descendants.push(currentId);

    const children = childrenMap[currentId] || [];
    for (const childId of children) {
      stack.push(childId);
    }
  }

  return descendants;
}

export default function App() {
  const [database, setDatabase] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [dropCoords, setDropCoords] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState([]);

  useEffect(() => {
    fetchDatabase()
      .then((data) => setDatabase(data))
      .catch((error) => console.error('Error loading database:', error));
  }, []);

  // Triggered when a node is dragged outside the boundary
  const handleSelectProject = (project, x = 0, y = 0) => {
    setActiveProject(project);
    setDropCoords({ x, y });
  };

  const handleNodeInteract = (clickedNode) => {
    if (!clickedNode) {
      return;
    }

    if (clickedNode.type === 'Project') {
      const fullProject = (database.projects || []).find((p) => p.id === clickedNode.id) || clickedNode;
      handleSelectProject(fullProject);
      return;
    }

    if (!database?.nodes || !['Root', 'Category', 'SubCategory'].includes(clickedNode.type)) {
      return;
    }

    const childrenMap = buildChildrenMap(database.nodes);

    setExpandedNodes((prevExpanded) => {
      if (!prevExpanded.includes(clickedNode.id)) {
        return [...prevExpanded, clickedNode.id];
      }

      const descendants = collectDescendants(clickedNode.id, childrenMap);
      const toRemove = new Set([clickedNode.id, ...descendants]);
      return prevExpanded.filter((id) => !toRemove.has(id));
    });
  };

  const closeViewer = () => {
    setActiveProject(null);
  };

  if (!database) {
    return (
      <div style={{ color: 'white', backgroundColor: '#000', height: '100vh', padding: '2rem' }}>
        Loading Continuum Space...
      </div>
    );
  }

  return (
    <>
      <MainScene
        database={database}
        site={database.site}
        onSelectProject={handleSelectProject}
        onNodeInteract={handleNodeInteract}
        expandedNodes={expandedNodes}
        isPaused={activeProject !== null}
      />

      <TelemetryHUD
        database={database}
        expandedNodes={expandedNodes}
        onNodeInteract={handleNodeInteract}
      />

      {activeProject && (
        <ModuleTransition
          key={activeProject.id}
          originX={dropCoords.x}
          originY={dropCoords.y}
          onClose={closeViewer}
        >
          <IfcLayover 
            project={activeProject}
          />
        </ModuleTransition>
      )}
    </>
  );
}