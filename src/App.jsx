import { useEffect, useState, useCallback, useRef } from 'react';
import MainScene from './universe/MainScene/MainScene';
import IfcLayover from './universe/IfcLayover';
import ModuleTransition from './components/ModuleTransition';
import TelemetryHUD from './components/TelemetryHUD';
import ProjectDetailsPanel from './components/ProjectDetailsPanel';
import FilterBar from './components/FilterBar';
import { fetchDatabase } from './utils/DataLoader';

// ── URL ↔ state sync helpers ────────────────────────────────────────────────
const VALID_FILTERS = ['All', 'Featured', 'BIM', 'Computational', 'Architecture', 'Urban', 'Art'];

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  const rawFilter = params.get('filter') ?? 'All';
  const filter = VALID_FILTERS.find(
    (f) => f.toLowerCase() === rawFilter.toLowerCase()
  ) ?? 'All';
  const q = params.get('q') ?? '';
  return { filter, q };
}

function writeURLParams(filter, q) {
  const params = new URLSearchParams();
  if (filter && filter !== 'All') params.set('filter', filter);
  if (q) params.set('q', q);
  const search = params.toString();
  const next = search ? `?${search}` : window.location.pathname;
  // replaceState to avoid cluttering history on every keystroke;
  // pushState is reserved for explicit navigation (see below).
  window.history.replaceState({ filter, q }, '', next);
}

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
  const [isHUDCollapsed, setIsHUDCollapsed] = useState(window.innerWidth < 1024);

  // Seed from URL so a shared link restores the exact view
  const [activeFilter, setActiveFilter] = useState(() => readURLParams().filter);
  const [searchQuery, setSearchQuery] = useState(() => readURLParams().q);
  const [isRadialMode, setIsRadialMode] = useState(true);

  const filterBarRef = useRef(null);

  const handleAboutMe = useCallback((x, y) => {
    if (!database?.aboutMeContent) return;

    const aboutMeProject = {
      id: 'about_me',
      title: 'About Me',
      layout: 'cv',
      content: database.aboutMeContent
    };

    setDropCoords({ x: x ?? window.innerWidth / 2, y: y ?? window.innerHeight / 2 });
    setActiveProject(aboutMeProject);
  }, [database]);

  const expandAll = useCallback(() => {
    if (!database?.nodes) return;
    const expandable = database.nodes
      .filter(n => ['Category', 'SubCategory'].includes(n.type))
      .map(n => n.id);
    setExpandedNodes(expandable);
  }, [database]);

  const collapseAll = useCallback(() => {
    setExpandedNodes([]);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'escape':
          setActiveProject(null);
          break;
        case 'e':
          expandAll();
          break;
        case 'c':
          collapseAll();
          break;
        case 'r':
        case 'm':
          setIsRadialMode(prev => !prev);
          break;
        case 'p':
          setIsPanelOpen(prev => !prev);
          break;
        case 'h':
        case 'i':
          setIsHUDCollapsed(prev => !prev);
          break;
        case 'a':
          handleAboutMe();
          break;
        case '/':
        case 'f':
          e.preventDefault();
          filterBarRef.current?.focusSearch?.();
          break;
        default:
          // Numeric filters 1-7
          if (e.key >= '1' && e.key <= '7') {
            const filters = ['All', 'Featured', 'BIM', 'Computational', 'Architecture', 'Urban', 'Art'];
            const filter = filters[parseInt(e.key) - 1];
            if (filter) setActiveFilter(filter);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandAll, collapseAll, handleAboutMe]);

  // ── Write URL whenever filter or search changes ──────────────────────────
  useEffect(() => {
    writeURLParams(activeFilter, searchQuery);
  }, [activeFilter, searchQuery]);

  // ── Sync state when user hits Back / Forward ─────────────────────────────
  useEffect(() => {
    const onPopState = (e) => {
      // e.state is populated by pushState/replaceState; fall back to parsing
      const { filter, q } = e.state ?? readURLParams();
      setActiveFilter(VALID_FILTERS.includes(filter) ? filter : 'All');
      setSearchQuery(q ?? '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);


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
      setIsPanelOpen(false);
    } else {
      // If something is expanded, we ensure the panel is open
      setIsPanelOpen(true);
    }
  }, [expandedNodes, database]);

  // Triggered when a node is dragged outside the boundary
  const handleSelectProject = useCallback((project, x = 0, y = 0) => {
    setActiveProject(project);
    setDropCoords({ x, y });
  }, []);

  const handleNodeFocus = useCallback((node) => {
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
  }, [database, expandedNodes.length]);

  const handleNodeInteract = useCallback((clickedNode) => {
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
  }, [database, handleSelectProject]);

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
            ref={filterBarRef}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearchQuery}
            onAboutMe={handleAboutMe}
            isRadialMode={isRadialMode}
            onRadialModeToggle={() => setIsRadialMode(!isRadialMode)}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
          />

          <TelemetryHUD
            database={database}
            expandedNodes={expandedNodes}
            onNodeInteract={handleNodeInteract}
            onNodeFocus={handleNodeFocus}
            onAboutMe={handleAboutMe}
            isCollapsed={isHUDCollapsed}
            onToggle={() => setIsHUDCollapsed(!isHUDCollapsed)}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
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
        isRadialMode={isRadialMode}
        setIsRadialMode={setIsRadialMode}
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