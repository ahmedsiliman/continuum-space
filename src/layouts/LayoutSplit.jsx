// src/layouts/LayoutSplit.jsx

export default function LayoutSplit({ project, blockRenderer }) {
  const slotOf = (block) => block?.position || block?.region;
  
  // 1. Sort the content into buckets based on the CSV 'position' column
  const leftContent = project.content.filter((block) => {
    const slot = slotOf(block);
    return slot === 'left' || slot === 'left_sidebar';
  });
  const rightContent = project.content.filter((block) => {
    const slot = slotOf(block);
    return slot === 'right' || slot === 'right_viewer';
  });

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#f4f4f5' }}>
      
      {/* LEFT BUCKET */}
      <div style={{ width: '30%', padding: '40px', overflowY: 'auto', borderRight: '1px solid #e4e4e7', color: '#18181b' }}>
        <h2 style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{project.title}</h2>
        {leftContent.map((block, index) => blockRenderer(block, index))}
      </div>

      {/* RIGHT BUCKET */}
      <div style={{ width: '70%', position: 'relative' }}>
        {rightContent.map((block, index) => blockRenderer(block, index + 200))}
      </div>

    </div>
  );
}