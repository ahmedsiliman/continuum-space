function buildIframeSrc(data) {
  const config = typeof data === 'string' ? { modelUrl: data } : data || {};
  const src = config.src || '/ifc-dashboard/IFC_Dashboard.html';

  let iframeUrl;
  try {
    iframeUrl = new URL(src, window.location.origin);
  } catch {
    iframeUrl = new URL('/ifc-dashboard/IFC_Dashboard.html', window.location.origin);
  }

  if (config.modelUrl) {
    const absoluteModelUrl = new URL(config.modelUrl, window.location.origin).href;
    iframeUrl.searchParams.set('modelUrl', absoluteModelUrl);
  }

  const params = config.params && typeof config.params === 'object' ? config.params : {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      iframeUrl.searchParams.set(key, String(value));
    }
  });

  return iframeUrl.toString();
}

export default function IframeBlock({ data }) {
  const config = typeof data === 'string' ? { modelUrl: data } : data || {};
  const iframeSrc = buildIframeSrc(config);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '360px', backgroundColor: '#0b0f15' }}>
      <iframe
        src={iframeSrc}
        title={config.title || 'IFC Viewer'}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="fullscreen"
      />
    </div>
  );
}
