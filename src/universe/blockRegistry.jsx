import TextBlock from '../components/TextBlock';
import ImageBlock from '../components/ImageBlock';
import IframeBlock from '../components/IframeBlock';

const DEFAULT_IFC_VIEWER_SRC = '/ifc-dashboard/IFC_Dashboard.html';

function toIframeData(block) {
  if (block.type === 'IFC_Iframe') {
    return block.data;
  }

  // BIM_Viewer always uses the built-in IFC dashboard.
  // externalApp is a dev-only field and must not override the viewer src.
  return {
    src: DEFAULT_IFC_VIEWER_SRC,
    modelUrl: block.data
  };
}

export function createBlockRenderer(project) {
  return (block, index) => {
    if (!block || !block.type) {
      return null;
    }

    if (block.type === 'Text') {
      return <TextBlock key={index} data={String(block.data || '')} />;
    }

    if (block.type === 'Image') {
      return <ImageBlock key={index} data={String(block.data || '')} />;
    }

    if (block.type === 'IFC_Iframe' || block.type === 'BIM_Viewer') {
      return <IframeBlock key={index} data={toIframeData(block)} />;
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
