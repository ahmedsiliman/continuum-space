import TextBlock from '../components/TextBlock';
import ImageBlock from '../components/ImageBlock';
import VideoBlock from '../components/VideoBlock';
import IframeBlock from '../components/IframeBlock';
import PowerBIBlock from '../components/PowerBIBlock';

const DEFAULT_IFC_VIEWER_SRC = '/ifc-dashboard/IFC_Dashboard.html';

function toIframeData(block) {
  const typeLower = String(block.type || '').toLowerCase().trim();
  if (typeLower === 'ifc_iframe') {
    return block.data;
  }

  // BIM_Viewer always uses the built-in IFC dashboard.
  // externalApp is a dev-only field and must not override the viewer src.
  return {
    src: DEFAULT_IFC_VIEWER_SRC,
    modelUrl: block.data
  };
}

// CSV-authored `data` for powerbi blocks arrives as a JSON string (the cell
// is something like {"src":"https://app.powerbi.com/view?r=..."}), but we
// also accept a bare URL string for the common case of "just the embed link,
// no extra params". Bad/partial JSON falls back to treating the raw value
// as the src rather than throwing, consistent with this registry's general
// "never let a malformed CSV row crash the render" posture.
function toPowerBIData(block) {
  const raw = block.data;

  if (raw && typeof raw === 'object') {
    return raw;
  }

  const str = String(raw || '').trim();
  if (str.startsWith('{')) {
    try {
      return JSON.parse(str);
    } catch {
      // fall through to treating it as a plain URL
    }
  }

  return { src: str };
}

export function createBlockRenderer(project) {
  return (block, index) => {
    if (!block || !block.type) {
      return null;
    }

    // Normalize once so CSV authoring inconsistencies (Video / video / VIDEO,
    // or padded whitespace like 'video      ') all resolve to the same
    // block, instead of silently falling through to "Unsupported block type".
    const typeLower = String(block.type).toLowerCase().trim();

    if (typeLower === 'text') {
      return <TextBlock key={index} data={String(block.data || '')} />;
    }

    if (typeLower === 'image') {
      return <ImageBlock key={index} data={String(block.data || '')} />;
    }

    if (typeLower === 'video') {
      return <VideoBlock key={index} data={String(block.data || '')} />;
    }

    if (typeLower === 'ifc_iframe' || typeLower === 'bim_viewer') {
      return <IframeBlock key={index} data={toIframeData(block)} />;
    }

    if (typeLower === 'powerbi' || typeLower === 'powerbi_iframe') {
      return <PowerBIBlock key={index} data={toPowerBIData(block)} />;
    }

    return (
      <div
        key={index}
        style={{
          border: '1px dashed #d4d4d8',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          padding: '10px 12px',
          color: '#3f3f46',
          fontSize: '0.9rem'
        }}
      >
        Unsupported block type: {block.type}
      </div>
    );
  };
}