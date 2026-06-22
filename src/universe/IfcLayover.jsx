import ProjectOverlayRenderer from '../components/ProjectOverlayRenderer';

export default function IfcLayover({ project }) {
  if (!project) return null;

  return (
    <div style={{
        position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100vh',
      backgroundColor: 'transparent', // Matches your universe background
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
    }}>
      
      {/* Top Control Bar */}
      <div style={{
        height: '60px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '0 40px',
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 10
      }}>
        <div style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          fontSize: '12px', 
          letterSpacing: '4px', 
          textTransform: 'uppercase',
          fontFamily: "'Share Tech Mono', 'Consolas', monospace",
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span style={{ color: '#f0f3f4', opacity: 0.8 }}>//</span>
          <span>{project.title}</span>
          <span style={{ color: '#f0f3f4', fontSize: '10px' }}>;</span>
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', overflowX: 'hidden', overflowY: 'auto', scrollBehavior: 'smooth' }}>
        <ProjectOverlayRenderer project={project} />
      </div>
    </div>
  );
}