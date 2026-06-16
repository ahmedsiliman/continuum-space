import IframeBlock from './IframeBlock';

// ── Shared glass tokens (mirrors TelemetryHUD / LayoutCv / IfcLayover) ───────
const MONO        = { fontFamily: "'Share Tech Mono', 'Consolas', monospace", textTransform: 'uppercase', letterSpacing: '2px' };
const GLASS_BG    = 'rgba(10, 10, 12, 0.45)';
const GLASS_BDR   = '1px solid rgba(255, 255, 255, 0.08)';
const GLASS_SHD   = '0 8px 32px 0 rgba(0,0,0,0.37), inset 0 1px 1px rgba(255,255,255,0.1)';
const LINE_SUB    = 'rgba(255, 255, 255, 0.05)';
const TEXT_DARK   = 'rgba(255, 255, 255, 0.25)';

const glassPanel = {
  backgroundColor: GLASS_BG,
  border: GLASS_BDR,
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: GLASS_SHD,
};

function PanelLabel({ children }) {
  return (
    <div style={{
      ...MONO,
      color: TEXT_DARK,
      fontSize: '10px',
      letterSpacing: '3px',
      padding: '14px 20px 12px',
      borderBottom: `1px solid ${LINE_SUB}`,
    }}>
      {children}
    </div>
  );
}

function regionMatch(region, accepted) {
  return accepted.includes(region);
}

export default function BIMDashboard({ project, blockRenderer }) {
  const content = Array.isArray(project?.content) ? project.content : [];
  const slotOf = (block) => block?.position || block?.region;

  const heroBlock =
    content.find((block) => regionMatch(slotOf(block), ['viewer_hero'])) ||
    content.find((block) => regionMatch(slotOf(block), ['hero', 'right_viewer']));

  const sidebarBlocks = content.filter((block) => regionMatch(slotOf(block), ['left_sidebar']));
  const detailBlocks = content.filter((block) => regionMatch(slotOf(block), ['details', 'left', 'right', 'center']));

  const detailLeftBlocks = detailBlocks.filter((block) => regionMatch(slotOf(block), ['left']));
  const detailRightBlocks = detailBlocks.filter((block) => regionMatch(slotOf(block), ['right']));
  const detailCenterBlocks = detailBlocks.filter((block) => regionMatch(slotOf(block), ['center', 'details']));

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: 'transparent' }}>

      {/* Hero viewer */}
      <div style={{
        width: '100%',
        height: 'clamp(320px, 72vh, 860px)',
        borderBottom: `1px solid ${LINE_SUB}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {heroBlock ? (
          blockRenderer(heroBlock, 0)
        ) : (
          <IframeBlock
            data={{
              src: '/ifc-dashboard/IFC_Dashboard.html',
              modelUrl: '/models/model_berlin_v3.ifc',
              title: `${project?.title || 'BIM'} Viewer`
            }}
          />
        )}
      </div>

      {/* Detail grid */}
      <div style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0',
        padding: '24px 24px 56px',
        display: 'grid',
        gap: '16px',
        boxSizing: 'border-box',
        gridTemplateColumns: sidebarBlocks.length > 0 ? '300px 1fr' : '1fr',
      }}>

        {/* Sidebar */}
        {sidebarBlocks.length > 0 && (
          <aside style={{ ...glassPanel, alignSelf: 'start' }}>
            <PanelLabel>Index</PanelLabel>
            <div style={{ padding: '16px 20px' }}>
              {sidebarBlocks.map((block, i) => blockRenderer(block, i + 1))}
            </div>
          </aside>
        )}

        {/* Main section — unified grid context */}
        <section style={{ 
          display: 'grid', 
          gap: '16px', 
          width: '100%',
          gridTemplateColumns: '3fr 7fr' // Controls horizontal splits globally
        }}>

          {/* Details Block */}
          {detailLeftBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column', gridColumn: 'span 1' }}>
              <PanelLabel>Overview</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                {detailLeftBlocks.map((block, i) => blockRenderer(block, i + 1000))}
              </div>
            </div>
          )}

          {/* Properties Block */}
          {detailRightBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column', gridColumn: 'span 1' }}>
              <PanelLabel>Cover</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                {detailRightBlocks.map((block, i) => blockRenderer(block, i + 2000))}
              </div>
            </div>
          )}

          {/* Center/Data Block — Explicitly spans both columns perfectly */}
          {detailCenterBlocks.length > 0 && (
            <div style={{ 
              ...glassPanel, 
              display: 'flex', 
              flexDirection: 'column', 
              gridColumn: '1 / -1' // Forces it to span from grid track 1 to the final edge track perfectly
            }}>
              <PanelLabel>Details</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                {detailCenterBlocks.map((block, i) => blockRenderer(block, i + 3000))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}