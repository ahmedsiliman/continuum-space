import { useEffect, useState } from 'react';
import MainScene from './universe/MainScene/MainScene';
import IfcLayover from './universe/IfcLayover';
import ModuleTransition from './components/ModuleTransition';
import TelemetryHUD from './components/TelemetryHUD';
import ProjectDetailsPanel from './components/ProjectDetailsPanel';
import FilterBar from './components/FilterBar';
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
  
  const [focusedNodeDetails, setFocusedNodeDetails] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAboutMe = (x, y) => {
    if (!database?.aboutMeContent) return;

    const aboutMeProject = {
      id: 'about_me',
      title: 'About Me',
      layout: 'cv',
      content: database.aboutMeContent
    };

    setDropCoords({ x, y });
    setActiveProject(aboutMeProject);
  };

  // Auto-expand tree to show filtered projects
  useEffect(() => {
    if (!database || (activeFilter === 'All' && searchQuery === '')) return;

    const matchingNodes = database.nodes.filter(node => {
      if (node.type !== 'Project') return false;
      const nodeFilters = node.filter ? node.filter.split(',').map(f => f.trim().toLowerCase()) : [];
      const matchesFilter = activeFilter === 'All' || nodeFilters.includes(activeFilter.toLowerCase());
      const matchesSearch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    if (matchingNodes.length === 0) return;

    setExpandedNodes(prev => {
      const nextExpanded = new Set(prev);
      matchingNodes.forEach(node => {
        let parentId = node.parent_id;
        while (parentId && parentId !== 'root') {
          nextExpanded.add(parentId);
          const parentNode = database.nodes.find(n => n.id === parentId);
          parentId = parentNode ? parentNode.parent_id : null;
        }
      });
      
      const nextArray = Array.from(nextExpanded);
      // Only update if something actually changed to avoid infinite loops
      if (nextArray.length === prev.length && nextArray.every(id => prev.includes(id))) {
        return prev;
      }
      return nextArray;
    });
  }, [activeFilter, searchQuery, database]);

  useEffect(() => {
    fetchDatabase()
      .then((data) => {
        setDatabase(data);
        // Set initial details but keep panel collapsed
        if (data?.details?.['root']) {
          setFocusedNodeDetails(data.details['root']);
          setIsPanelOpen(false); // Start collapsed
        }
      })
      .catch((error) => console.error('Error loading database:', error));
  }, []);

  // Auto-manage panel state based on expanded nodes
  useEffect(() => {
    if (!database) return;
    
    if (expandedNodes.length === 0) {
      // If everything is collapsed, we close the panel 
      // UNLESS we are in the middle of a project transition or something? 
      // For now, follow the rule: all collapsed = panel closed.
      setIsPanelOpen(false);
    } else {
      // If something is expanded, we ensure the panel is open
      setIsPanelOpen(true);
    }
  }, [expandedNodes, database]);

  // Triggered when a node is dragged outside the boundary
  const handleSelectProject = (project, x = 0, y = 0) => {
    setActiveProject(project);
    setDropCoords({ x, y });
  };

  const handleNodeFocus = (node) => {
    if (!database?.details) return;

    if (!node) {
      // If we lose focus (hover away), check if we should stay open
      if (expandedNodes.length === 0) {
        setIsPanelOpen(false);
      } else {
        // Keep the most recent details displayed; do not revert to root
      }
      return;
    }

    const details = database.details[node.id];
    if (details) {
      setFocusedNodeDetails(details);
      setIsPanelOpen(true);
    }
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
      const isCurrentlyExpanded = prevExpanded.includes(clickedNode.id);
      let nextExpanded;

      if (!isCurrentlyExpanded) {
        nextExpanded = [...prevExpanded, clickedNode.id];
      } else {
        const descendants = collectDescendants(clickedNode.id, childrenMap);
        const toRemove = new Set([clickedNode.id, ...descendants]);
        nextExpanded = prevExpanded.filter((id) => !toRemove.has(id));
      }

      // If we are collapsing the last node, ensure panel closes
      if (nextExpanded.length === 0) {
        setIsPanelOpen(false);
        if (database.details['root']) {
          setFocusedNodeDetails(database.details['root']);
        }
      } else {
        setIsPanelOpen(true);
        // Focus the interacted node
        const details = database.details[clickedNode.id];
        if (details) setFocusedNodeDetails(details);
      }

      return nextExpanded;
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
      {!activeProject && (
        <>
          <FilterBar 
            onFilterChange={setActiveFilter}
            onSearchChange={setSearchQuery}
            onAboutMe={handleAboutMe}
          />

          <TelemetryHUD
            database={database}
            expandedNodes={expandedNodes}
            onNodeInteract={handleNodeInteract}
            onNodeFocus={handleNodeFocus}
          />

          <ProjectDetailsPanel 
            details={focusedNodeDetails} 
            isOpen={isPanelOpen} 
            onToggle={() => setIsPanelOpen(!isPanelOpen)} 
          />
        </>
      )}

      <MainScene
        database={database}
        site={database.site}
        onSelectProject={handleSelectProject}
        onNodeInteract={handleNodeInteract}
        onNodeFocus={handleNodeFocus}
        expandedNodes={expandedNodes}
        isPaused={activeProject !== null}
        activeFilter={activeFilter}
        searchQuery={searchQuery}
      />

      {activeProject && (
        <ModuleTransition
          key={activeProject.id}
          originX={dropCoords.x}
          originY={dropCoords.y}
          onClose={closeViewer}
          isAboutMe={activeProject.id === 'about_me'}
        >
          <IfcLayover 
            project={activeProject}
          />
        </ModuleTransition>
      )}
    </>
  );
}