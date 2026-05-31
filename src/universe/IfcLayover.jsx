import ProjectOverlayRenderer from '../components/ProjectOverlayRenderer';

export default function IfcLayover({ project }) {
  if (!project) return null;

  return (
    <div style={{
        position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#02040a', // Matches your universe background
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Top Control Bar */}
      <div style={{
        height: '60px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '0 30px',
        backgroundColor: '#000'
      }}>
        <div style={{ 
          color: 'white', 
          fontSize: '14px', 
          letterSpacing: '2px', 
          textTransform: 'uppercase' 
        }}>
          {project.title} // ACTIVE PROJECT
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <ProjectOverlayRenderer project={project} />
      </div>
    </div>
  );
}