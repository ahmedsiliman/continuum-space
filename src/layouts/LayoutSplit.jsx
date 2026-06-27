// ── Shared glass tokens (mirrors TelemetryHUD / BIMDashboard / IfcLayover) ──
const MONO      = { fontFamily: "'Share Tech Mono', 'Consolas', monospace", textTransform: 'uppercase', letterSpacing: '2px' };
const GLASS_BG  = 'rgba(10, 10, 12, 0.45)';
const GLASS_BDR = '1px solid rgba(255, 255, 255, 0.08)';
const GLASS_SHD = '0 8px 32px 0 rgba(0,0,0,0.37), inset 0 1px 1px rgba(255,255,255,0.1)';
const LINE_SUB  = 'rgba(255, 255, 255, 0.05)';
const TEXT_DARK = 'rgba(255, 255, 255, 0.25)';

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
  return accepted.includes(String(region || '').trim());
}

// Same CSS overrides as BIMDashboard — keeps grid tile and video panel
// behaviour consistent across both layout types.
const LAYOUT_SPLIT_CSS = `
  @keyframes splitPaneFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .layout-split-pane {
    animation: splitPaneFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bim-grid-image-tile { width: 100%; height: 100%; }
  .bim-grid-image-tile > div {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
  }
  .bim-grid-image-tile img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block; }

  .bim-video-panel > div { margin: 0 !important; }

  @media (max-width: 640px) {
    .bim-overview-cover-row {
      grid-template-columns: 1fr !important;
    }
    .bim-image-desc-row {
      grid-template-columns: 1fr !important;
    }
    .bim-video-desc-row {
      grid-template-columns: 1fr !important;
    }
    .bim-detail-grid {
      padding: 12px 12px 40px !important;
    }
    .bim-sidebar {
      display: none !important;
    }
  }
`;

function LayoutSplitStyles() {
  return <style>{LAYOUT_SPLIT_CSS}</style>;
}

// Groups consecutive same-type blocks into runs — prose stacks normally,
// back-to-back images tile into a responsive grid.
function groupConsecutiveByType(blocks) {
  const groups = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (last && last.type === block?.type) {
      last.blocks.push(block);
    } else {
      groups.push({ type: block?.type, blocks: [block] });
    }
  }
  return groups;
}

// Prose stacks normally; runs of 2+ images tile into a responsive grid;
// a single isolated image stays full width.
function RegionContent({ blocks, blockRenderer, keyOffset }) {
  const groups = groupConsecutiveByType(blocks);
  let runningIndex = 0;

  return groups.map((group, groupIdx) => {
    const startIndex = runningIndex;
    runningIndex += group.blocks.length;

    if (group.type === 'Image' && group.blocks.length > 1) {
      return (
        <div
          key={`grp-${groupIdx}`}
          style={{
            display: 'grid',
            gap: '10px',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            margin: '12px 0',
          }}
        >
          {group.blocks.map((block, i) => (
            <div
              key={`img-${startIndex + i}`}
              className="bim-grid-image-tile"
              style={{
                position: 'relative',
                borderRadius: '6px',
                overflow: 'hidden',
                border: GLASS_BDR,
                aspectRatio: '4 / 3',
              }}
            >
              {blockRenderer(block, keyOffset + startIndex + i)}
            </div>
          ))}
        </div>
      );
    }

    return group.blocks.map((block, i) =>
      blockRenderer(block, keyOffset + startIndex + i)
    );
  });
}

// Gallery region: every block tiles regardless of type.
function GalleryGrid({ blocks, blockRenderer, keyOffset }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '10px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))',
      }}
    >
      {blocks.map((block, i) => (
        <div
          key={`gallery-${i}`}
          className={block?.type === 'Image' ? 'bim-grid-image-tile' : undefined}
          style={{
            position: 'relative',
            borderRadius: '6px',
            overflow: 'hidden',
            border: GLASS_BDR,
            aspectRatio: '4 / 3',
          }}
        >
          {blockRenderer(block, keyOffset + i)}
        </div>
      ))}
    </div>
  );
}

export default function LayoutSplit({ project, blockRenderer }) {
  const content = Array.isArray(project?.content) ? project.content : [];
  const slotOf  = (block) => block?.position || block?.region;

  // Region buckets — mirrors BIMDashboard exactly, minus the hero/viewer slot.
  const sidebarBlocks = content.filter((b) => regionMatch(slotOf(b), ['left_sidebar', 'left']));
  const overviewBlocks = content.filter((b) => regionMatch(slotOf(b), ['overview']));
  // Cover: all blocks in the `cover` region — accepts images and video blocks.
  const coverBlocks   = content.filter((b) => regionMatch(slotOf(b), ['cover']));
  const galleryBlocks = content.filter((b) => regionMatch(slotOf(b), ['gallery']));
  const imageBlocks       = content.filter((b) => regionMatch(slotOf(b), ['image']));
  const imageDescBlocks   = content.filter((b) => regionMatch(slotOf(b), ['image_description']));
  const videoBlocks       = content.filter((b) => regionMatch(slotOf(b), ['video']));
  const videoDescBlocks   = content.filter((b) => regionMatch(slotOf(b), ['video_description']));
  const detailsBlocks     = content.filter((b) => regionMatch(slotOf(b), ['details', 'right', 'right_viewer']));

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', background: 'transparent' }}>
      <LayoutSplitStyles />

      <div className="bim-detail-grid layout-split-pane" style={{
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
          <aside className="bim-sidebar" style={{ ...glassPanel, alignSelf: 'start' }}>
            <PanelLabel>Index</PanelLabel>
            <div style={{ padding: '16px 20px' }}>
              {/* Project title header, matching original LayoutSplit behaviour */}
              {project?.title && (
                <h2 style={{
                  ...MONO,
                  color: 'rgba(255, 255, 255, 0.95)',
                  fontSize: '13px',
                  fontWeight: 500,
                  margin: '0 0 20px 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingBottom: '14px',
                }}>
                  {project.title}
                </h2>
              )}
              {sidebarBlocks.map((block, i) => blockRenderer(block, i + 1))}
            </div>
          </aside>
        )}

        {/* Main section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>

          {/* Row 1: Overview + Cover — same narrow/wide split as BIMDashboard */}
          {(overviewBlocks.length > 0 || coverBlocks.length > 0) && (
            <div className="bim-overview-cover-row" style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: overviewBlocks.length > 0 && coverBlocks.length > 0
                ? 'minmax(280px, 5fr) 7fr'
                : '1fr',
            }}>
              {overviewBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Overview</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1 }}>
                    <RegionContent blocks={overviewBlocks} blockRenderer={blockRenderer} keyOffset={1000} />
                  </div>
                </div>
              )}
              {coverBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Cover</PanelLabel>
                  <div className="bim-video-panel" style={{ padding: '16px 20px', flex: 1 }}>
                    <RegionContent blocks={coverBlocks} blockRenderer={blockRenderer} keyOffset={2000} />
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Row 3: Image + optional Image Description side panel */}
          {imageBlocks.length > 0 && (
            <div
              className="bim-image-desc-row"
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: imageDescBlocks.length > 0 ? '7fr 4fr' : '1fr',
                alignItems: 'stretch',
              }}
            >
              {/* Image panel */}
              <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                <PanelLabel>Image</PanelLabel>
                <div
                  className="bim-grid-image-tile"
                  style={{ padding: '16px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {imageBlocks.map((block, i) => blockRenderer(block, i + 3200))}
                </div>
              </div>

              {/* Image description panel — text blocks get inner padding via RegionContent */}
              {imageDescBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Description</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                    <RegionContent blocks={imageDescBlocks} blockRenderer={blockRenderer} keyOffset={3300} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 4: Video + optional Video Description side panel */}
          {videoBlocks.length > 0 && (
            <div
              className="bim-video-desc-row"
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: videoDescBlocks.length > 0 ? '7fr 4fr' : '1fr',
                alignItems: 'stretch',
              }}
            >
              {/* Video player panel */}
              <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                <PanelLabel>Video</PanelLabel>
                <div style={{ padding: '16px 20px', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div className="bim-video-panel" style={{ width: '94%' }}>
                    {videoBlocks.map((block, i) => blockRenderer(block, i + 3500))}
                  </div>
                </div>
              </div>

              {/* Video description panel — text blocks get inner padding via RegionContent */}
              {videoDescBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Description</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                    <RegionContent blocks={videoDescBlocks} blockRenderer={blockRenderer} keyOffset={3600} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 2: Gallery */}
          {galleryBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
              <PanelLabel>Gallery</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <GalleryGrid blocks={galleryBlocks} blockRenderer={blockRenderer} keyOffset={3000} />
              </div>
            </div>
          )}
          
          {/* Row 5: Details — also catches `right` / `right_viewer` slots
              that the original LayoutSplit used as its main content pane. */}
          {detailsBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
              <PanelLabel>Details</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <RegionContent blocks={detailsBlocks} blockRenderer={blockRenderer} keyOffset={4000} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}