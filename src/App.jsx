import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  const project = params.get('project') ?? '';
  return { filter, q, project };
}

function writeURLParams(filter, q, project) {
  const params = new URLSearchParams(window.location.search);
  if (filter && filter !== 'All') {
    params.set('filter', filter);
  } else {
    params.delete('filter');
  }
  if (q) {
    params.set('q', q);
  } else {
    params.delete('q');
  }
  if (project) {
    params.set('project', project);
  } else {
    params.delete('project');
  }
  const search = params.toString();
  const next = search ? `?${search}` : window.location.pathname;
  window.history.replaceState({ filter, q, project }, '', next);
}

function buildChildrenMap(nodes = []) {
  return nodes.reduce((map, node) => {
    const parentId = node.parent_id;
    if (!parentId) return map;
    if (!map[parentId]) map[parentId] = [];
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
    for (const childId of children) stack.push(childId);
  }
  return descendants;
}

// ── Tutorial stages ──────────────────────────────────────────────────────────
// 'category'    → pulse first Category, hint "tap to expand"
// 'subcategory' → pulse first SubCategory of expanded category, hint "tap to expand"
// 'project'     → pulse first Project of expanded subcategory, hint "drag outward"
// 'done'        → tutorial complete, nothing rendered
// Resets on every page load (including hard refresh) — the rings are
// ambient enough not to annoy returning users, and there's no server session.

export default function App() {
  const [database, setDatabase] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [instantOpen, setInstantOpen] = useState(false);
  const [dropCoords, setDropCoords] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState([]);

  const [focusedNodeDetails, setFocusedNodeDetails] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isHUDCollapsed, setIsHUDCollapsed] = useState(window.innerWidth < 1024);

  const [activeFilter, setActiveFilter] = useState(() => readURLParams().filter);
  const [searchQuery, setSearchQuery] = useState(() => readURLParams().q);
  // Captured once, synchronously, on first render — before the writeURLParams
  // effect below ever runs. That effect rewrites the URL based on React state
  // (activeProject is still null at that point), which would otherwise strip
  // `?project=` out of the address bar before fetchDatabase's async .then()
  // gets a chance to read it.
  const [initialProjectId] = useState(() => readURLParams().project);
  const [isRadialMode, setIsRadialMode] = useState(true);

  // Tutorial always starts at 'category' on every page load
  const [tutorialStage, setTutorialStage] = useState('category');

  const filterBarRef = useRef(null);

  // ── Advance tutorial on interaction ────────────────────────────────────────
  // Called by handleNodeInteract when the node that was just interacted with
  // is the current tutorial target. We derive target IDs from live node lists
  // so they work regardless of CSV data ordering.
  const advanceTutorial = useCallback((clickedNode) => {
    if (tutorialStage === 'done') return;
    if (tutorialStage === 'category' && clickedNode.type === 'Category') {
      setTutorialStage('subcategory');
    } else if (tutorialStage === 'subcategory' && clickedNode.type === 'SubCategory') {
      setTutorialStage('project');
    } else if (tutorialStage === 'project' && clickedNode.type === 'Project') {
      setTutorialStage('done');
    }
  }, [tutorialStage]);

  // Mark tutorial done when a project is dragged open (selectProject path)
  const markTutorialDone = useCallback(() => {
    if (tutorialStage !== 'done') setTutorialStage('done');
  }, [tutorialStage]);

  // ── Derive which node the tutorial should highlight ─────────────────────────
  // Returns { nodeId, stage, hint } or null when tutorial is done.
  const tutorialTarget = useMemo(() => {
    if (tutorialStage === 'done' || !database?.nodes) return null;

    const nodes = database.nodes;

    if (tutorialStage === 'category') {
      const first = nodes.find((n) => n.type === 'Category');
      if (!first) return null;
      return { nodeId: first.id, stage: 'category', hint: 'TAP TO EXPAND' };
    }

    if (tutorialStage === 'subcategory') {
      // Find a SubCategory whose parent is currently expanded
      const expandedSet = new Set(expandedNodes);
      const first = nodes.find((n) => n.type === 'SubCategory' && expandedSet.has(n.parent_id));
      if (!first) return null;
      return { nodeId: first.id, stage: 'subcategory', hint: 'TAP TO EXPAND' };
    }

    if (tutorialStage === 'project') {
      // Find a Project whose parent SubCategory is currently expanded
      const expandedSet = new Set(expandedNodes);
      const first = nodes.find((n) => n.type === 'Project' && expandedSet.has(n.parent_id));
      if (!first) return null;
      return { nodeId: first.id, stage: 'project', hint: 'DRAG OUTWARD TO OPEN' };
    }

    return null;
  }, [tutorialStage, database, expandedNodes]);

  const handleAboutMe = useCallback((x, y) => {
    if (!database?.aboutMeContent) return;
    const aboutMeProject = {
      id: 'about_me',
      title: 'About Me',
      layout: 'cv',
      content: database.aboutMeContent
    };
    setInstantOpen(false);
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
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'escape': setActiveProject(null); break;
        case 'e': expandAll(); break;
        case 'c': collapseAll(); break;
        case 'r': case 'm': setIsRadialMode(prev => !prev); break;
        case 'p': setIsPanelOpen(prev => !prev); break;
        case 'h': case 'i': setIsHUDCollapsed(prev => !prev); break;
        case 'a': handleAboutMe(); break;
        case '/': case 'f':
          e.preventDefault();
          filterBarRef.current?.focusSearch?.();
          break;
        default:
          if (e.key >= '1' && e.key <= '7') {
            const filters = ['All', 'Featured', 'BIM', 'Computational', 'Architecture', 'Urban', 'Art'];
            const filter = filters[parseInt(e.key) - 1];
            if (filter) setActiveFilter(filter);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandAll, collapseAll, handleAboutMe]);

  useEffect(() => {
    writeURLParams(activeFilter, searchQuery, activeProject?.id ?? '');
  }, [activeFilter, searchQuery, activeProject]);

  useEffect(() => {
    const onPopState = (e) => {
      const { filter, q, project } = e.state ?? readURLParams();
      setActiveFilter(VALID_FILTERS.includes(filter) ? filter : 'All');
      setSearchQuery(q ?? '');
      if (!project) setActiveProject(null);
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
      if (nextArray.length === prev.length && nextArray.every(id => prev.includes(id))) return prev;
      return nextArray;
    });
  }, [activeFilter, searchQuery, database]);

  useEffect(() => {
    fetchDatabase()
      .then((data) => {
        setDatabase(data);

        // BEFORE (in fetchDatabase .then):
        if (data?.details?.['root']) {
          setFocusedNodeDetails(data.details['root']);
          setIsPanelOpen(false); // Start collapsed
        }

        // AFTER:
        if (data?.details?.['root']) {
          setFocusedNodeDetails(data.details['root']);
          setIsPanelOpen(true); // Open on first visit
        }

        // Deep-link: restore an opened project (and its ancestor chain) from the URL
        const projectId = initialProjectId;
        if (projectId) {
          if (projectId === 'about_me' && data?.aboutMeContent) {
            setInstantOpen(true);
            setActiveProject({ id: 'about_me', title: 'About Me', layout: 'cv', content: data.aboutMeContent });
            setDropCoords({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          } else {
            const matchedProject = (data?.projects || []).find((p) => p.id === projectId);
            if (matchedProject) {
              setInstantOpen(true);
              setActiveProject(matchedProject);
              setDropCoords({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
              const nodeMap = new Map((data?.nodes || []).map((n) => [n.id, n]));
              const ancestors = [];
              let parentId = nodeMap.get(projectId)?.parent_id;
              while (parentId && parentId !== 'root') {
                ancestors.push(parentId);
                parentId = nodeMap.get(parentId)?.parent_id;
              }
              if (ancestors.length) setExpandedNodes(ancestors);
              setTutorialStage('done');
            }
          }
        }

      })
      .catch((error) => console.error('Error loading database:', error));
  }, []);

  useEffect(() => {
    if (!database) return;
    setIsPanelOpen(true);
  }, [expandedNodes, database]);

  const handleSelectProject = useCallback((project, x = 0, y = 0) => {
    markTutorialDone();
    setInstantOpen(false);
    setActiveProject(project);
    setDropCoords({ x, y });
  }, [markTutorialDone]);

  const handleNodeFocus = useCallback((node) => {
    if (!database?.details) return;
    if (!node) {
      if (expandedNodes.length === 0) setIsPanelOpen(false);
      return;
    }
    const details = database.details[node.id];
    if (details) {
      setFocusedNodeDetails(details);
      setIsPanelOpen(true);
    }
  }, [database, expandedNodes.length]);

  const handleNodeInteract = useCallback((clickedNode) => {
    if (!clickedNode) return;

    if (clickedNode.type === 'Project') {
      const fullProject = (database.projects || []).find((p) => p.id === clickedNode.id) || clickedNode;
      handleSelectProject(fullProject);
      return;
    }

    if (!database?.nodes || !['Root', 'Category', 'SubCategory'].includes(clickedNode.type)) return;

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

      if (nextExpanded.length === 0) {
        setIsPanelOpen(false);
        if (database.details['root']) setFocusedNodeDetails(database.details['root']);
      } else {
        setIsPanelOpen(true);
        const details = database.details[clickedNode.id];
        if (details) setFocusedNodeDetails(details);
      }

      return nextExpanded;
    });

    // Advance tutorial only when expanding (not collapsing)
    const isCurrentlyExpanded = expandedNodes.includes(clickedNode.id);
    if (!isCurrentlyExpanded) {
      advanceTutorial(clickedNode);
    }
  }, [database, handleSelectProject, expandedNodes, advanceTutorial]);

  const closeViewer = () => setActiveProject(null);

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
        tutorialTarget={tutorialTarget}
      />

      {activeProject && (
        <ModuleTransition
          key={activeProject.id}
          originX={dropCoords.x}
          originY={dropCoords.y}
          onClose={closeViewer}
          isAboutMe={activeProject.id === 'about_me'}
          instant={instantOpen}
        >
          <IfcLayover project={activeProject} />
        </ModuleTransition>
      )}
    </>
  );
}