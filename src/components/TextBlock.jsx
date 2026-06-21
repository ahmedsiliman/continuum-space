// TextBlock.jsx — Smart text renderer for CSV content
// Handles: plain paragraphs, bullet lists (•, -, *), inline code, section headers
// All content is authored in the CSV `data` cell; this component formats it visually.

const MONO = {
  fontFamily: "'Share Tech Mono', 'Consolas', monospace",
  letterSpacing: '1px',
};

const PALETTE = {
  body:    'rgba(255, 255, 255, 0.70)',
  dim:     'rgba(255, 255, 255, 0.38)',
  accent:  'rgba(120, 200, 255, 0.85)',
  bullet:  'rgba(120, 200, 255, 0.55)',
  rule:    'rgba(255, 255, 255, 0.07)',
  codeBg:  'rgba(255, 255, 255, 0.06)',
};

// ─── helpers ────────────────────────────────────────────────────────────────

/** Detect bullet markers: •, –, -, *, tab-bullet */
function isBullet(line) {
  return /^[\t ]*[•\-\*–][\t ]/.test(line);
}

/** Strip the bullet marker and leading whitespace */
function stripBullet(line) {
  return line.replace(/^[\t ]*[•\-\*–][\t ]+/, '').trim();
}

/** Detect a section header: line ending with ':' and no bullet prefix */
function isHeader(line) {
  return !isBullet(line) && /[A-Z].*:$/.test(line.trim());
}

/** Render inline `code` spans inside a string */
function InlineText({ text, style }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <span style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            style={{
              ...MONO,
              fontSize: '0.9em',
              background: PALETTE.codeBg,
              color: PALETTE.accent,
              borderRadius: '3px',
              padding: '0 5px',
              letterSpacing: '0.5px',
            }}
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── segment parser ──────────────────────────────────────────────────────────
// Splits raw text into typed segments: paragraph | bullets | header

function parseSegments(raw) {
  if (!raw) return [];

  // Normalise line endings and split
  const lines = raw
    .replace(/\\n/g, '\n')   // unescape literal \n from CSV
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const segments = [];
  let bulletAccum = [];
  let paraAccum   = [];

  function flushPara() {
    if (paraAccum.length === 0) return;
    segments.push({ type: 'paragraph', text: paraAccum.join(' ').trim() });
    paraAccum = [];
  }
  function flushBullets() {
    if (bulletAccum.length === 0) return;
    segments.push({ type: 'bullets', items: [...bulletAccum] });
    bulletAccum = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushBullets();
      continue;
    }
    if (isHeader(line) && !isBullet(line)) {
      flushPara();
      flushBullets();
      segments.push({ type: 'header', text: line });
    } else if (isBullet(line)) {
      flushPara();
      bulletAccum.push(stripBullet(line));
    } else {
      flushBullets();
      paraAccum.push(line);
    }
  }
  flushPara();
  flushBullets();

  return segments;
}

// ─── sub-renderers ───────────────────────────────────────────────────────────

function ParagraphBlock({ text }) {
  return (
    <p style={{
      margin: '0 0 10px',
      fontSize: '13px',
      lineHeight: '1.85',
      color: PALETTE.body,
      ...MONO,
    }}>
      <InlineText text={text} />
    </p>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{
      margin: '0 0 12px',
      padding: 0,
      listStyle: 'none',
    }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            marginBottom: '6px',
            fontSize: '13px',
            lineHeight: '1.7',
            color: PALETTE.body,
            ...MONO,
          }}
        >
          {/* Accent bullet tick */}
          <span style={{
            color: PALETTE.bullet,
            fontSize: '10px',
            marginTop: '4px',
            flexShrink: 0,
            userSelect: 'none',
          }}>
            ▸
          </span>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  );
}

function SectionHeader({ text }) {
  return (
    <div style={{
      ...MONO,
      fontSize: '10px',
      color: PALETTE.dim,
      letterSpacing: '3px',
      textTransform: 'uppercase',
      marginBottom: '8px',
      marginTop: '14px',
      paddingBottom: '6px',
      borderBottom: `1px solid ${PALETTE.rule}`,
    }}>
      {text}
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * TextBlock
 *
 * Props:
 *   data {string} — raw text from the CSV `data` column.
 *
 * CSV authoring guide (write this in the cell):
 *
 *   Plain paragraph  →  just type text, may wrap across the cell
 *   Bullet item      →  • item text   or   - item text   or   * item text
 *   Section header   →  My Section:        (capitalised, ends with colon)
 *   Inline code      →  wrap in backticks: `MyClass.Run()`
 *   Line break       →  \n  (literal backslash-n in the cell)
 *
 * Multiple bullets are grouped automatically. Empty lines separate paragraphs.
 * Examle cell content:
 * "Roles:\n• Modeling and coordination\n• Clash detection\n\nTools: `Dynamo`, `Grasshopper`"
 */
export default function TextBlock({ data }) {
  const segments = parseSegments(data ?? '');

  if (segments.length === 0) {
    return (
      <div style={{ ...MONO, color: PALETTE.dim, fontSize: '12px', padding: '8px 0' }}>
        —
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'header')    return <SectionHeader key={i} text={seg.text} />;
        if (seg.type === 'bullets')   return <BulletList    key={i} items={seg.items} />;
        if (seg.type === 'paragraph') return <ParagraphBlock key={i} text={seg.text} />;
        return null;
      })}
    </div>
  );
}