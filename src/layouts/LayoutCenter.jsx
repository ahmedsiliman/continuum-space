export default function LayoutCenter({ project, blockRenderer }) {
  const mainBlocks = project.content.filter((block) => {
    const slot = block.position || block.region;
    return slot === 'center' || slot === 'main';
  });

  return (
    <div style={{ maxWidth: '900px', margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
      {mainBlocks.map((block, index) => blockRenderer(block, index))}
    </div>
  );
}