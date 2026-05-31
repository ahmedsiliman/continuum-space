export default function TextBlock({ data }) {
  return (
    <div style={{ 
      padding: '10px 0', 
      fontSize: '1.1rem', 
      lineHeight: '1.8', 
      color: '#444',
      fontFamily: 'serif' // Matches the elegant vibe of your screenshots
    }}>
      {/* If data contains newlines, map them to <br> tags */}
      {data.split('\n').map((line, i) => (
        <span key={i}>
          {line}
          <br />
        </span>
      ))}
    </div>
  );
}