import IframeBlock from './IframeBlock';

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
  const detailBlocks = content.filter((block) => regionMatch(slotOf(block), ['details']));

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: '#f4f4f5' }}>
      <div
        style={{
          width: '100%',
          height: 'clamp(320px, 72vh, 860px)',
          borderBottom: '1px solid #d4d4d8',
          backgroundColor: '#0b0f15'
        }}
      >
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

      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 56px',
          display: 'grid',
          gap: '28px',
          gridTemplateColumns: sidebarBlocks.length > 0 ? '320px minmax(0, 1fr)' : 'minmax(0, 1fr)'
        }}
      >
        {sidebarBlocks.length > 0 && (
          <aside
            style={{
              alignSelf: 'start',
              border: '1px solid #e4e4e7',
              borderRadius: '10px',
              padding: '18px',
              backgroundColor: '#ffffff'
            }}
          >
            {sidebarBlocks.map((block, index) => blockRenderer(block, index + 1))}
          </aside>
        )}

        <section>
          {detailBlocks.map((block, index) => blockRenderer(block, index + 1000))}
        </section>
      </div>
    </div>
  );
}