import { layoutRegistry } from '../universe/layoutRegistry.jsx';
import { createBlockRenderer } from '../universe/blockRegistry.jsx';

export default function ProjectOverlayRenderer({ project }) {
  if (!project) {
    return null;
  }

  const LayoutComponent = layoutRegistry[project.layout];
  const blockRenderer = createBlockRenderer(project);

  if (!LayoutComponent) {
    return (
      <div
        style={{
          maxWidth: '900px',
          margin: '60px auto',
          backgroundColor: '#111827',
          color: '#f9fafb',
          padding: '24px',
          borderRadius: '12px'
        }}
      >
        Unknown project layout: {project.layout}
      </div>
    );
  }

  return (
    <LayoutComponent project={project} blockRenderer={blockRenderer} />
  );
}
