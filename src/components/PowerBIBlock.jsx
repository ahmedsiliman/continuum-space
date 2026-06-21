import IframeBlock from './IframeBlock';

// Power BI "Publish to web" embeds are just an iframe with a Microsoft-hosted
// src (https://app.powerbi.com/view?r=...). We reuse IframeBlock rather than
// duplicating its src-building / previewToken-forwarding logic — this block
// only adapts the CSV `data` shape into what IframeBlock already expects.
//
// Accepts either:
//   - a bare string: the Power BI "Publish to web" URL
//   - an object: { src, title, params }
//       params are forwarded as extra query params on the iframe src, e.g.
//       { pageName: 'ReportSection1' } to deep-link a specific report page.
export default function PowerBIBlock({ data }) {
  const config = typeof data === 'string' ? { src: data } : data || {};

  if (!config.src) {
    return (
      <div
        style={{
          border: '1px dashed rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(10,10,12,0.45)',
          borderRadius: '8px',
          padding: '10px 12px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.9rem',
        }}
      >
        Power BI block missing `src` (expected a "Publish to web" embed URL).
      </div>
    );
  }

  return (
    <IframeBlock
      data={{
        src: config.src,
        title: config.title || 'Power BI Dashboard',
        params: config.params,
      }}
    />
  );
}