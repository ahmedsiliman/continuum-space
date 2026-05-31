export default function ImageBlock({ data }) {
  return (
    <div style={{ width: '100%', margin: '40px 0', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      <img src={data} alt="Project Graphic" style={{ width: '100%', height: 'auto', display: 'block' }} />
    </div>
  );
}