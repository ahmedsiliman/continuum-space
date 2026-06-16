// ── Shared glass tokens (mirrors panel system) ────────────────────────────
const GLASS_BG     = 'rgba(10, 10, 12, 0.45)';
const GLASS_BORDER = '1px solid rgba(255, 255, 255, 0.08)';
const GLASS_SHADOW = '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.1)';
const MONO         = "'Share Tech Mono', 'Consolas', monospace";

export default function LayoutCenter({ project, blockRenderer }) {
  const mainBlocks = project.content.filter((block) => {
    const slot = block.position || block.region;
    return slot === 'center' || slot === 'main';
  });

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes layoutFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .layout-center-panel {
          animation: layoutFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      <div
        className="layout-center-panel"
        style={{
          maxWidth: '900px',
          margin: '60px auto',
          padding: '32px 40px',
          background: GLASS_BG,
          border: GLASS_BORDER,
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: GLASS_SHADOW,
        }}
      >
        {/* Project title header */}
        {project.title && (
          <h2
            style={{
              fontFamily: MONO,
              color: 'rgba(255, 255, 255, 0.95)',
              fontSize: '15px',
              fontWeight: 500,
              margin: '0 0 24px 0',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              textAlign: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              paddingBottom: '16px',
            }}
          >
            {project.title}
          </h2>
        )}

        <div style={{ textAlign: 'center' }}>
          {mainBlocks.map((block, index) => blockRenderer(block, index))}
        </div>
      </div>
    </div>
  );
}