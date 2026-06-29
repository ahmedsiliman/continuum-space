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

// ── Multi-instance region helpers ─────────────────────────────────────────────
//
// Numbered region convention:
//   image / image_1 / image_2 …          → landscape image panel (+ optional desc)
//   image_description / image_description_1 …  → paired description
//   portrait / portrait_1 / portrait_2 … → 2-up portrait column pair
//   video / video_1 …                    → video panel (existing, unchanged)
//   video_description / video_description_1 …  → paired description
//
// Un-suffixed names (image, portrait, video, …) are treated as instance 1
// so existing CSV data needs no changes.

// Returns a sorted, de-duped array of integer instance numbers present in
// content for a given base region name, e.g. 'image' → [1, 2, 3]
function collectInstances(content, slotOf, baseName) {
  const nums = new Set();
  for (const b of content) {
    const slot = String(slotOf(b) || '').trim();
    // bare name  → instance 1
    if (slot === baseName) { nums.add(1); continue; }
    // name_N     → instance N
    const m = slot.match(new RegExp(`^${baseName}_(\\d+)$`));
    if (m) nums.add(parseInt(m[1], 10));
  }
  return [...nums].sort((a, b) => a - b);
}

// Filters blocks that belong to a specific numbered instance.
// Instance 1 matches both bare name and name_1.
function blocksForInstance(content, slotOf, baseName, n) {
  return content.filter((b) => {
    const slot = String(slotOf(b) || '').trim();
    if (n === 1 && slot === baseName) return true;
    return slot === `${baseName}_${n}`;
  });
}

// ── Portrait pair row ─────────────────────────────────────────────────────────
// Lays two portrait images side-by-side in a fixed 2-col grid (3:4 ratio).
// Any extra blocks beyond the first two are stacked beneath.
function PortraitPairRow({ blocks, blockRenderer, keyOffset }) {
  const pair  = blocks.slice(0, 2);
  const extra = blocks.slice(2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        display: 'grid',
        gap: '10px',
        gridTemplateColumns: '1fr 1fr',
      }}>
        {pair.map((block, i) => (
          <div
            key={`portrait-${i}`}
            className="bim-grid-image-tile"
            style={{
              position: 'relative',
              borderRadius: '6px',
              overflow: 'hidden',
              border: GLASS_BDR,
              aspectRatio: '3 / 4',
            }}
          >
            {blockRenderer(block, keyOffset + i)}
          </div>
        ))}
      </div>
      {extra.map((block, i) => blockRenderer(block, keyOffset + 2 + i))}
    </div>
  );
}

export default function LayoutSplit({ project, blockRenderer }) {
  const content = Array.isArray(project?.content) ? project.content : [];
  const slotOf  = (block) => block?.position || block?.region;

  // ── Static region buckets (unchanged) ──────────────────────────────────────
  const sidebarBlocks  = content.filter((b) => regionMatch(slotOf(b), ['left_sidebar', 'left']));
  const overviewBlocks = content.filter((b) => regionMatch(slotOf(b), ['overview']));
  const coverBlocks    = content.filter((b) => regionMatch(slotOf(b), ['cover']));
  const galleryBlocks  = content.filter((b) => regionMatch(slotOf(b), ['gallery']));
  const detailsBlocks  = content.filter((b) => regionMatch(slotOf(b), ['details', 'right', 'right_viewer']));

  // ── Multi-instance instance lists ──────────────────────────────────────────
  const imageInstances    = collectInstances(content, slotOf, 'image');
  const videoInstances    = collectInstances(content, slotOf, 'video');
  const portraitInstances = collectInstances(content, slotOf, 'portrait');

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

          {/* Row 1: Overview + Cover */}
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

          {/* ── Image rows — one per instance ──────────────────────────────── */}
          {/* Regions: image | image_1 | image_2 …                             */}
          {/*          image_description | image_description_1 | …             */}
          {imageInstances.map((n) => {
            const imgBlocks  = blocksForInstance(content, slotOf, 'image', n);
            const descBlocks = blocksForInstance(content, slotOf, 'image_description', n);
            if (!imgBlocks.length) return null;
            const keyBase = 3200 + (n - 1) * 200;
            return (
              <div
                key={`image-row-${n}`}
                className="bim-image-desc-row"
                style={{
                  display: 'grid',
                  gap: '16px',
                  gridTemplateColumns: descBlocks.length > 0 ? '7fr 4fr' : '1fr',
                  alignItems: 'stretch',
                }}
              >
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Image{imageInstances.length > 1 ? ` ${n}` : ''}</PanelLabel>
                  <div
                    className="bim-grid-image-tile"
                    style={{ padding: '16px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {imgBlocks.map((block, i) => blockRenderer(block, keyBase + i))}
                  </div>
                </div>
                {descBlocks.length > 0 && (
                  <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                    <PanelLabel>Description</PanelLabel>
                    <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                      <RegionContent blocks={descBlocks} blockRenderer={blockRenderer} keyOffset={keyBase + 100} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Portrait pair rows — one per instance ──────────────────────── */}
          {/* Regions: portrait | portrait_1 | portrait_2 …                    */}
          {/* Each instance renders exactly 2 images side-by-side at 3:4 ratio */}
          {portraitInstances.map((n) => {
            const pBlocks = blocksForInstance(content, slotOf, 'portrait', n);
            if (!pBlocks.length) return null;
            const keyBase = 5000 + (n - 1) * 200;
            return (
              <div
                key={`portrait-row-${n}`}
                style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}
              >
                <PanelLabel>Portrait{portraitInstances.length > 1 ? ` ${n}` : ''}</PanelLabel>
                <div style={{ padding: '16px 20px', flex: 1 }}>
                  <PortraitPairRow blocks={pBlocks} blockRenderer={blockRenderer} keyOffset={keyBase} />
                </div>
              </div>
            );
          })}

          {/* ── Video rows — one per instance ──────────────────────────────── */}
          {/* Regions: video | video_1 | video_2 …                             */}
          {/*          video_description | video_description_1 | …             */}
          {videoInstances.map((n) => {
            const vidBlocks  = blocksForInstance(content, slotOf, 'video', n);
            const descBlocks = blocksForInstance(content, slotOf, 'video_description', n);
            if (!vidBlocks.length) return null;
            const keyBase = 3500 + (n - 1) * 200;
            return (
              <div
                key={`video-row-${n}`}
                className="bim-video-desc-row"
                style={{
                  display: 'grid',
                  gap: '16px',
                  gridTemplateColumns: descBlocks.length > 0 ? '7fr 4fr' : '1fr',
                  alignItems: 'stretch',
                }}
              >
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Video{videoInstances.length > 1 ? ` ${n}` : ''}</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="bim-video-panel" style={{ width: '94%' }}>
                      {vidBlocks.map((block, i) => blockRenderer(block, keyBase + i))}
                    </div>
                  </div>
                </div>
                {descBlocks.length > 0 && (
                  <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                    <PanelLabel>Description</PanelLabel>
                    <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                      <RegionContent blocks={descBlocks} blockRenderer={blockRenderer} keyOffset={keyBase + 100} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Gallery */}
          {galleryBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
              <PanelLabel>Gallery</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <GalleryGrid blocks={galleryBlocks} blockRenderer={blockRenderer} keyOffset={3000} />
              </div>
            </div>
          )}

          {/* Details */}
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