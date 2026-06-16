export default function TextBlock({ data }) {
  return (
    <div style={{ 
      padding: '12px 0', 
      fontSize: '13px', 
      lineHeight: '1.8', 
      color: 'rgba(255, 255, 255, 0.7)',
      fontFamily: "'Share Tech Mono', 'Consolas', monospace",
      letterSpacing: '1px'
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