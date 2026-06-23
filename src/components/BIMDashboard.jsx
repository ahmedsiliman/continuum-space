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
  // Defensive trim: CSV columns are sometimes space-padded (a recurring
  // issue in this project's content.csv), so 'video ' or ' video' should
  // still match 'video'.
  return accepted.includes(String(region || '').trim());
}

// ImageBlock is built for standalone, full-width document flow: its outer
// div carries `margin: 40px 0` and its <img> uses `height: auto` (intrinsic
// ratio). When we tile several images into a grid, we need that same
// component to instead fill + crop a fixed-aspect cell. Rather than fork
// ImageBlock (other layouts rely on its current standalone behavior), we
// scope an override to just our grid tiles via a wrapper class.
//
// Note: ImageBlock's hover transition (transform/box-shadow) is left
// intact here intentionally, matching Cover's behavior. With source
// images now resized to a sane max dimension (see resize_gallery_images.py),
// per-tile compositing layers from the transition are a smaller cost than
// they were when assets were 90+ megapixel originals — if scroll
// performance regresses with many gallery tiles, this is the first place
// to revisit (re-add `transition/transform/box-shadow: none !important`
// to .bim-grid-image-tile > div).
const GRID_TILE_IMAGE_OVERRIDE_CSS = `
  .bim-grid-image-tile { width: 100%; height: 100%; }
  .bim-grid-image-tile > div {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
  }
  .bim-grid-image-tile img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block; }

  /* VideoBlock defaults to a standalone-document-flow margin (40px 0),
     meant for use outside a panel. The Video row already gets consistent
     16px/20px panel padding like every other section, so we zero out
     VideoBlock's own margin here to avoid doubling up the whitespace. */
  .bim-video-panel > div { margin: 0 !important; }

  /* Mobile: collapse the Overview/Cover side-by-side split into a vertical
     stack. minmax(280px, 5fr) / 7fr cannot fit on a narrow viewport and
     causes horizontal overflow, making the layout feel like a draggable canvas. */
  @media (max-width: 640px) {
    .bim-overview-cover-row {
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

function GridImageTileStyles() {
  return <style>{GRID_TILE_IMAGE_OVERRIDE_CSS}</style>;
}

// Groups a flat block list into runs of consecutive same-type blocks.
// E.g. [Text, Text, Image, Image, Image, Text] ->
//   [{type:'Text', blocks:[…2]}, {type:'Image', blocks:[…3]}, {type:'Text', blocks:[…1]}]
// This lets us render prose as a normal stack but tile back-to-back images
// into a responsive grid, without reordering anything relative to the source data.
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

// Renders a region's blocks: prose stacks normally, runs of 2+ images
// tile into a responsive grid; a single isolated image stays full width.
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

    // Text runs (or a single standalone image) render in normal document flow.
    return group.blocks.map((block, i) =>
      blockRenderer(block, keyOffset + startIndex + i)
    );
  });
}

// Gallery region: every block here is explicitly meant to tile, regardless
// of type — unlike Overview/Details, no grouping heuristic is needed.
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

export default function BIMDashboard({ project, blockRenderer }) {
  const content = Array.isArray(project?.content) ? project.content : [];
  const slotOf = (block) => block?.position || block?.region;

  const heroBlock =
    content.find((block) => regionMatch(slotOf(block), ['viewer_hero'])) ||
    content.find((block) => regionMatch(slotOf(block), ['hero', 'right_viewer']));

  const sidebarBlocks = content.filter((block) => regionMatch(slotOf(block), ['left_sidebar']));

  const overviewBlocks = content.filter((block) => regionMatch(slotOf(block), ['overview']));

  // Cover: first block in the `cover` region only. Anything else tagged
  // `cover` is ignored — move it to `gallery` in the CSV if it should render.
  const coverBlocks = content.filter((block) => regionMatch(slotOf(block), ['cover'])).slice(0, 1);

  const galleryBlocks = content.filter((block) => regionMatch(slotOf(block), ['gallery']));

  const videoBlocks = content.filter((block) => regionMatch(slotOf(block), ['video']));

  const detailsBlocks = content.filter((block) => regionMatch(slotOf(block), ['details']));

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', background: 'transparent' }}>
      <GridImageTileStyles />

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
      <div className="bim-detail-grid" style={{
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
              {sidebarBlocks.map((block, i) => blockRenderer(block, i + 1))}
            </div>
          </aside>
        )}

        {/* Main section — stacked rows, each with its own layout rules */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>

          {/* Row 1: Overview (text) + Cover (single image) — only this row uses the narrow/wide split */}
          {(overviewBlocks.length > 0 || coverBlocks.length > 0) && (
            <div className="bim-overview-cover-row" style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: overviewBlocks.length > 0 && coverBlocks.length > 0
                ? 'minmax(280px, 5fr) 7fr'
                : '1fr',
            }}>
              {/* Overview Block */}
              {overviewBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Overview</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1 }}>
                    <RegionContent blocks={overviewBlocks} blockRenderer={blockRenderer} keyOffset={1000} />
                  </div>
                </div>
              )}

              {/* Cover Block — single image only */}
              {coverBlocks.length > 0 && (
                <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
                  <PanelLabel>Cover</PanelLabel>
                  <div style={{ padding: '16px 20px', flex: 1 }}>
                    <RegionContent blocks={coverBlocks} blockRenderer={blockRenderer} keyOffset={2000} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 2: Gallery — full width, every block tiles regardless of type */}
          {galleryBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
              <PanelLabel>Gallery</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <GalleryGrid blocks={galleryBlocks} blockRenderer={blockRenderer} keyOffset={3000} />
              </div>
            </div>
          )}

          {/* Row 3: Video — single wide, centered block (not tiled, not full-bleed) */}
          {videoBlocks.length > 0 && (
            <div style={{ ...glassPanel, display: 'flex', flexDirection: 'column' }}>
              <PanelLabel>Video</PanelLabel>
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div className="bim-video-panel" style={{ width: '100%', maxWidth: '960px' }}>
                  {videoBlocks.map((block, i) => blockRenderer(block, i + 3500))}
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Details — full-width text/specs, sits at the bottom when present */}
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