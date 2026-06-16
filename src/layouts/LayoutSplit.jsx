// ── Shared glass tokens (mirrors panel system) ────────────────────────────
const GLASS_BG     = 'rgba(10, 10, 12, 0.45)';
const GLASS_BORDER = '1px solid rgba(255, 255, 255, 0.08)';
const GLASS_SHADOW = '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.1)';
const MONO         = "'Share Tech Mono', 'Consolas', monospace";

export default function LayoutSplit({ project, blockRenderer }) {
  const slotOf = (block) => block?.position || block?.region;

  const leftContent  = project.content.filter((b) => {
    const s = slotOf(b); return s === 'left' || s === 'left_sidebar';
  });
  const rightContent = project.content.filter((b) => {
    const s = slotOf(b); return s === 'right' || s === 'right_viewer';
  });

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100%', gap: '16px', padding: '24px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes splitPaneFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .layout-split-pane {
          animation: splitPaneFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      {/* LEFT PANEL */}
      <div
        className="layout-split-pane"
        style={{
          width: '30%',
          flexShrink: 0,
          padding: '28px',
          background: GLASS_BG,
          border: GLASS_BORDER,
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: GLASS_SHADOW,
        }}
      >
// ... rest of component ...
        <h2
          style={{
            fontFamily: MONO,
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: '13px',
            fontWeight: 500,
            margin: '0 0 20px 0',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '14px',
          }}
        >
          {project.title}
        </h2>

        {leftContent.map((block, index) => blockRenderer(block, index))}
      </div>

      {/* RIGHT PANEL */}
      <div
        className="layout-split-pane"
        style={{
          flex: 1,
          position: 'relative',
          background: GLASS_BG,
          border: GLASS_BORDER,
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: GLASS_SHADOW,
          overflow: 'hidden',
        }}
      >
        {rightContent.map((block, index) => blockRenderer(block, index + 200))}
      </div>
    </div>
  );
}