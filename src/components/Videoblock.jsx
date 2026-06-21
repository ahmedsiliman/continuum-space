// VideoBlock.jsx — renders either a self-hosted <video> or a YouTube/Vimeo
// embed, depending on what the CSV `data` cell contains. No autodetection
// flag needed in the CSV itself: the URL shape tells us which to use.
//
// CSV authoring:
//   Self-hosted file  ->  /projects/BIM_CRD/Newgiza/walkthrough.mp4
//   YouTube            ->  https://www.youtube.com/watch?v=XXXXXXXXXXX
//                           https://youtu.be/XXXXXXXXXXX
//   Vimeo               ->  https://vimeo.com/123456789

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

function getEmbedInfo(url) {
  if (typeof url !== 'string') return null;

  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) {
    return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  const vimeoMatch = url.match(VIMEO_RE);
  if (vimeoMatch) {
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return null; // not a recognized embed host -> treat as a self-hosted file
}

export default function VideoBlock({ data }) {
  const src = typeof data === 'string' ? data.trim() : '';
  if (!src) return null;

  const embed = getEmbedInfo(src);

  return (
    <div
      style={{
        width: '100%',
        margin: '40px 0', // standalone document flow; BIMDashboard's Video panel overrides this via .bim-video-panel CSS
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        position: 'relative',
        aspectRatio: '16 / 9',
        backgroundColor: '#0b0f15',
      }}
    >
      {embed ? (
        <iframe
          src={embed.embedUrl}
          title={`${embed.provider} video`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video
          src={src}
          controls
          preload="metadata"
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
      )}
    </div>
  );
}